use image::io::Reader as ImageReader;
use once_cell::sync::Lazy;
use rlua::{Value, FromLua, Context};
use rlua::prelude::{LuaResult, LuaError, LuaString};
use std::hash::Hash;
use std::ops::Index;
// #[cfg(unix)]
// use std::os::fd::{RawFd, AsRawFd, OwnedFd, FromRawFd};
// #[cfg(windows)]
// use std::os::windows::io::{RawHandle, AsRawHandle, OwnedHandle, FromRawHandle};

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub enum Resampler {
    Nearest = 0,
    Bilinear = 1,
}

impl<'lua> FromLua<'lua> for Resampler {
    fn from_lua(lua_value: Value<'lua>, lua: Context<'lua>) -> LuaResult<Self> {
        match u8::from_lua(lua_value, lua) {
            Ok(0)=> Ok(Resampler::Nearest),
            Ok(1)=> Ok(Resampler::Bilinear),
            Ok(_)=> Ok(Resampler::Nearest),
            Err(e)=> Err(e)
        }
    }
}

/// dontstarve affine transform
/// a, b, c, d, tx, ty
#[derive(Debug, PartialEq, Clone, Copy)]
struct AffineTransform {
    a: f64,
    b: f64,
    c: f64,
    d: f64,
    tx: f64,
    ty: f64,
}

impl Hash for AffineTransform {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        state.write(&f64::to_le_bytes(self.a));
        state.write(&f64::to_le_bytes(self.b));
        state.write(&f64::to_le_bytes(self.c));
        state.write(&f64::to_le_bytes(self.d));
        state.write(&f64::to_le_bytes(self.tx));
        state.write(&f64::to_le_bytes(self.ty));
    }
}

#[allow(dead_code)]
impl AffineTransform {
    /// build an identity affine transform
    fn identity() -> Self {
        AffineTransform {
            a: 1.0, b: 0.0,
            c: 0.0, d: 1.0,
            tx: 0.0, ty: 0.0
        }
    }

    /// build a transform from vec
    fn from_vec(vec: Vec<f64>) -> Self {
        AffineTransform {
            a: vec[0], 
            b: vec[1], 
            c: vec[2], 
            d: vec[3], 
            tx: vec[4], 
            ty: vec[5],
        }
    }

    /// apply a translate x/y, return the result
    fn translate(&self, tx: f64, ty: f64) -> Self {
        AffineTransform { 
            tx: self.tx + tx,  
            ty: self.ty + ty,
            ..*self 
        }
    }
    /// apply a matrix multiply, return the result
    fn mult_with(&self, other: &AffineTransform) -> Self {
        let (a, b) = (self, other);
        AffineTransform {
            a: a.a*b.a+a.b*b.c,
            b: a.a*b.b+a.b*b.d,
            c: a.c*b.a+a.d*b.c,
            d: a.c*b.b+a.d*b.d,
            tx: a.a*b.tx+a.b*b.ty+a.tx,
            ty: a.c*b.tx+a.d*b.ty+a.ty,
        }
    }

    /// calculate reverse matrix
    fn reverse(&self) -> Self {
        let j: f64 = self.d*self.a-self.b*self.c; // matrix adj
        AffineTransform { 
            a: self.d/j, 
            b: self.b/-j, 
            c: self.c/-j, 
            d: self.a/j, 
            tx: (self.c*self.ty-self.d*self.tx)/j, 
            ty: (self.b*self.tx-self.a*self.ty)/j
        }
    }

    /// apply affine transform on coord xy
    fn onpoint(&self, px: f64, py: f64) -> (f64, f64) {
        (self.tx + self.a * px + self.c * py, 
         self.ty + self.b * px + self.d * py)
    }

    /// check if any NAN is not in matrix
    fn is_valid(&self) -> bool {
        f64::is_finite(self.a) &&
        f64::is_finite(self.b) &&
        f64::is_finite(self.c) &&
        f64::is_finite(self.d) &&
        f64::is_finite(self.tx) &&
        f64::is_finite(self.ty)
    }

    /// convert to unique bytes
    fn to_bytes(self) -> Vec<u8> {
        [f64::to_le_bytes(self.a),
        f64::to_le_bytes(self.b),
        f64::to_le_bytes(self.c),
        f64::to_le_bytes(self.d),
        f64::to_le_bytes(self.tx),
        f64::to_le_bytes(self.ty)]
        .iter()
        .flatten()
        .copied()
        .collect()
    }
}

impl Index<usize> for AffineTransform {
    type Output = f64;
    fn index(&self, index: usize) -> &f64 {
        match index {
            0 => &self.a,
            1 => &self.b,
            2 => &self.c,
            3 => &self.d,
            4 => &self.tx,
            5 => &self.ty,
            _ => panic!("Index out of bound")
        }
    }
}

pub mod lua_image {
    use std::sync::mpsc::sync_channel;
    use std::sync::{Arc, Condvar, Mutex};
    use std::thread::spawn;

    use image::{DynamicImage, Pixel, Rgba, Rgb, ImageBuffer, GenericImageView, GenericImage};
    use image::ColorType;
    use rlua::{AnyUserData, Context};
    use rlua::Value;
    use rlua::{Function, MetaMethod, UserData, UserDataMethods, Variadic, Table};

    use crate::filesystem::lua_filesystem::ConvertArgToString;

    use super::*;

    struct AsyncEncoder {
        condvar: Arc<Condvar>,
        tasks: Arc<Mutex<Vec<(Image, String)>>>,
    }

    impl AsyncEncoder {
        fn new() -> Self {
            let num_threads = num_cpus::get().min(16);
            let condvar = Arc::new(Condvar::new());
            let tasks = Arc::new(Mutex::new(Vec::<(Image, String)>::new()));
            let _workers = (0..num_threads).map(|_|{
                let condvar = Arc::clone(&condvar);
                let tasks = Arc::clone(&tasks);
                spawn(move ||{
                    loop {
                        let (img, path) = {
                            let mut tasks = tasks.lock().unwrap();
                            while tasks.is_empty() {
                                tasks = condvar.wait(tasks).unwrap();
                            }
                            tasks.pop().unwrap()
                        };
                        if let Err(err) = img.save(path.as_str()) {
                            eprintln!("Failed to save image `{}` because of Error: {}", path, err);
                        }
                        condvar.notify_all(); // notify main thread to check if tasks cleared
                    }
                })
            }).collect::<Vec<_>>();
    
            Self {
                condvar,
                tasks,
            }
        }

        /// add a new image encoding task to thread pool
        fn add_task(&self, img: Image, path: String) {
            let mut tasks = self.tasks.lock().unwrap();
            tasks.push((img, path));
            self.condvar.notify_all();
        }

        /// block until all tasks finished
        fn wait(&self) {
            let mut tasks = self.tasks.lock().unwrap();
            while !tasks.is_empty() {
                tasks = self.condvar.wait(tasks).unwrap();
            }
        }
    }

    static ASYNC_SAVER: Lazy<Mutex<AsyncEncoder>> = Lazy::new(||{
        Mutex::new(AsyncEncoder::new())
    });

    pub struct Image {
        pub width: u32, 
        pub height: u32,
        inner: DynamicImage,
    }

    impl Image {
        pub fn open(path: &str) -> Result<Self, &'static str> {
            let reader = match ImageReader::open(path) {
                Ok(r)=> r,
                Err(_)=> return Err("Failed to open image file"),
            };
            let img = match reader.decode() {
                Ok(r)=> r,
                Err(_)=> return Err("Failed to decode image data"),
            };
            Ok(Self::from_img(img))  
        }

        #[inline]
        pub fn as_bytes(&self) -> &[u8]{
            self.inner.as_bytes()
        }

        fn from_rgba(bytes: Vec<u8>, width: u32, height: u32) -> Option<Self> {
            if (bytes.len() as u32) < width * height * 4 {
                None
            }
            else{
                ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(width, height, bytes)
                    .map(|buf| Self::from_img(DynamicImage::from(buf)))
            }
        }

        fn from_rgb(bytes: Vec<u8>, width: u32, height: u32) -> Option<Self> {
            if (bytes.len() as u32) < width * height * 3 {
                None
            }
            else {
                ImageBuffer::<Rgb<u8>, _>::from_raw(width, height, bytes)
                    .map(|buf| Self::from_img(DynamicImage::from(buf)))
            }
        }

        fn clone(&self) -> Self {
            Self {
                width: self.width,
                height: self.height,
                inner: self.inner.clone(),
            }
        }

        fn pixel_size(&self) -> usize {
            match self.inner.color() {
                ColorType::Rgba8 => 4,
                ColorType::Rgb8 => 3,
                _ => usize::MAX,
           }
        }

        fn from_img(inner: DynamicImage) -> Self {
            Image {
                width: inner.width(),
                height: inner.height(),
                inner
            }
        }

        fn pixelformat(&self) -> &'static str {
            match self.inner.color() {
                ColorType::Rgba8 => "RGBA",
                ColorType::Rgb8 => "RGB",
                _ => "other",
            }
        }

        fn get_pixel(&self, x: u32, y: u32) -> Option<Rgba<u8>> {
            if x >= self.width || y >= self.height {
                None
            }
            else {
                Some(unsafe { self.inner.unsafe_get_pixel(x, y) })
            }
        }

        fn get_pixel_float(&self, x: f64, y: f64) -> Option<Rgba<u8>> {
            if x < 0.0 || y < 0.0 || x >= self.width as f64 || y >= self.height as f64 {
                None
            }
            else {
                Some(unsafe {
                    self.inner.unsafe_get_pixel(x as u32, y as u32)
                })
            }
        }

        fn set_pixel(&mut self, x: u32, y: u32, pixel: Rgba<u8>) {
            unsafe { self.inner.unsafe_put_pixel(x, y, pixel) };
        }
        
        /// merge two rgba colors
        fn merge_color(c1: Option<Rgba<u8>>, c2: Option<Rgba<u8>>, percent: f64) -> Option<Rgba<u8>> {
            match (c1, c2) {
                (Some(c1), Some(c2))=> {
                    let (a1, a2) = (c1[3] as f64 * percent, c2[3] as f64 * (1.0 - percent));
                    let alpha = a1 + a2;
                    Some(Rgba::from([
                        Self::normalize((c1[0] as f64 * a1 + c2[0] as f64 * a2)/alpha),
                        Self::normalize((c1[1] as f64 * a1 + c2[1] as f64 * a2)/alpha),
                        Self::normalize((c1[2] as f64 * a1 + c2[2] as f64 * a2)/alpha),
                        Self::normalize(alpha)
                    ]))
                },
                (Some(c1), None)=> {
                    Some(Rgba::from([c1[0], c1[1], c1[2], Self::normalize(c1[3] as f64 * percent)]))
                },
                (None, Some(c2))=> {
                    Some(Rgba::from([c2[0], c2[1], c2[2], Self::normalize(c2[3] as f64 * (1.0 - percent))]))
                },
                (None, None)=> None,
            }
        }
        /// convert float color to u8 (0-255)
        #[inline]
        fn normalize(c: f64) -> u8 {
           f64::clamp(c.round(), 0.0, 255.0) as u8
        }
        /// apply transform on the image, return new one
        /// transforming method is define as a closure, eg: |(px, py)| -> (sx*2.0, sy*2.0)
        /// NOTE: bbox not calculated
        pub fn transform(&self, width: u32, height: u32,
            transformer: impl Fn(u32, u32)-> (f64, f64), resampler: Resampler) -> Self {
            let mut imgbuf = image::ImageBuffer::<Rgba<u8>, Vec<u8>>::new(width, height);
            let source_width = self.width;
            let source_height = self.height;
            for (x, y, pixel) in imgbuf.enumerate_pixels_mut() {
                // sampler point
                let (sx, sy) = transformer(x, y);
                let sp = match resampler {
                    Resampler::Nearest => {
                        let sx = f64::round(sx);
                        let sy = f64::round(sy);
                        self.get_pixel_float(sx, sy)
                    },
                    Resampler::Bilinear => {
                        if sx < -3.0 || sy < -3.0 || sx > source_width as f64 + 3.0 || sy > source_height as f64 + 3.0 {
                            continue;
                        }
                        // left right top bottom
                        let sx_left = f64::floor(sx);
                        let sx_right = sx_left + 1.0;
                        let sy_top = f64::floor(sy);
                        let sy_bottom = sy_top + 1.0;
                        let rgba_left = Image::merge_color(
                            self.get_pixel_float(sx_left,  sy_top),
                            self.get_pixel_float(sx_left, sy_bottom),
                            1.0 - (sy - sy_top));
                        let rgba_right = Image::merge_color(
                            self.get_pixel_float(sx_right,  sy_top),
                            self.get_pixel_float(sx_right, sy_bottom),
                            1.0 - (sy - sy_top));
                        Image::merge_color(
                            rgba_left,
                            rgba_right,
                            1.0 - (sx - sx_left))
                    }
                };
                if let Some(color) = sp {
                    *pixel = color
                }
            }
            Self::from_img(DynamicImage::from(imgbuf))
        }

        /// apply affine transform on an image, return the new image
        fn affine_transform(&self, width: u32, height: u32, matrix: AffineTransform, resampler: Resampler) -> Result<Self, &'static str> {
            let rev_matrix = matrix.reverse();
            if rev_matrix.is_valid() {
                let transformer = |x, y|rev_matrix.onpoint(x as f64, y as f64);
                Ok(self.transform(width, height, transformer, resampler))
            }
            else {
                Err("Invalid affine matrix: nan")
            }
        }

        /// paste another image on this, this method will mutate dest image pixels
        pub fn paste(&mut self, other: Image, px: i64, py: i64) {
            let (width, height) = (self.width as i64, self.height as i64);
            for (x, y, pixel) in other.inner.pixels() {
                let ox = px + x as i64;
                let oy = py + y as i64;
                if ox < 0 || oy < 0 || ox >= width || oy >= height {
                    continue;
                }
                let background = self.get_pixel(ox as u32, oy as u32).unwrap();
                let merge = match pixel[3] as u32 {
                    255=> pixel,
                    0=> background,
                    n=> {
                        // ref to Pillow AlphaComposite.c #ImagingAlphaComposite
                        const PRECISION_BITS: u32 = 16 - 8 - 2;
                        let shift_for_div255 = |a| ((a >> 8) + a) >> 8;
                        let clamp = |a: u32| a.clamp(0, 255) as u8;

                        let blend = background[3] as u32 * (255 - n);
                        let outa255 = n*255 + blend;
                        let coef1 = n*255*255* (1 << PRECISION_BITS) / outa255;
                        let coef2 = 255* (1 << PRECISION_BITS) - coef1;
                        
                        let (tmpr, tmpg, tmpb) = (
                            pixel[0] as u32 * coef1 + background[0] as u32 * coef2,
                            pixel[1] as u32 * coef1 + background[1] as u32 * coef2,
                            pixel[2] as u32 * coef1 + background[2] as u32 * coef2,
                        );
                        let (r, g, b, a) = (
                            shift_for_div255(tmpr + (0x80 << PRECISION_BITS)) >> PRECISION_BITS,
                            shift_for_div255(tmpg + (0x80 << PRECISION_BITS)) >> PRECISION_BITS,
                            shift_for_div255(tmpb + (0x80 << PRECISION_BITS)) >> PRECISION_BITS,
                            shift_for_div255(outa255 + 0x80)
                        );
                        Rgba::from([clamp(r), clamp(g), clamp(b), clamp(a)])
                    },
                    #[allow(unreachable_patterns)]
                    n=> {
                        let a1: f64 = n as f64 / 255.0;
                        let a2: f64 = background[3] as f64 / 255.0;
                        let a1a2 = a1* a2;
                        let alpha = a1 + a2 - a1a2;
                        // rgb
                        let r1a1 = pixel[0] as f64 / 255.0 * a1;
                        let g1a1 = pixel[1] as f64 / 255.0 * a1;
                        let b1a1 = pixel[2] as f64 / 255.0 * a1;
                        let r2a2 = background[0] as f64 / 255.0 * a2;
                        let g2a2 = background[1] as f64 / 255.0 * a2;
                        let b2a2 = background[2] as f64 / 255.0 * a2;
                        Rgba::<u8>::from([
                            Image::normalize((r1a1 + r2a2 - r2a2* a1)/alpha* 255.0),
                            Image::normalize((g1a1 + g2a2 - g2a2* a1)/alpha* 255.0),
                            Image::normalize((b1a1 + b2a2 - b2a2* a1)/alpha* 255.0),
                            Image::normalize(alpha* 255.0)
                        ])
                    }
                };
                self.set_pixel(ox as u32, oy as u32, merge);
            }
        }

        #[inline]
        pub fn save(&self, path: &str) -> image::ImageResult<()> {
            self.inner.save(path)
        }

        #[inline]
        pub fn save_async(&self, path: &str) {
            ASYNC_SAVER.lock().unwrap().add_task(
                self.clone(),
                path.to_string()
            );
        }

        pub fn save_png_bytes(&self) -> Vec<u8> {
            let mut writer = std::io::Cursor::new(Vec::<u8>::with_capacity(10000));
            image::write_buffer_with_format(&mut writer, 
                self.inner.as_bytes(), 
                self.width, self.height, 
                self.inner.color(), 
                image::ImageFormat::Png).unwrap();
            writer.get_ref().to_vec()
        }

        pub fn apply_filter(&mut self, filter: &Filter) {
            match &mut self.inner {
                DynamicImage::ImageRgba8(buffer)=> {
                    buffer.pixels_mut().for_each(|pixel|{
                        pixel[0] = filter.r[pixel[0] as usize];
                        pixel[1] = filter.g[pixel[1] as usize];
                        pixel[2] = filter.b[pixel[2] as usize];
                        pixel[3] = filter.a[pixel[3] as usize];
                    })
                },
                DynamicImage::ImageRgb8(buffer)=> {
                    buffer.pixels_mut().for_each(|pixel|{
                        pixel[0] = filter.r[pixel[0] as usize];
                        pixel[1] = filter.g[pixel[1] as usize];
                        pixel[2] = filter.b[pixel[2] as usize];
                    })
                },
                _ => panic!("apply_filter only support rgb/rgba image")
            }
        }

        pub fn apply_cc(&mut self, cc: &[u8], percent: f64) -> Result<(), &'static str> {
            if cc.len() < 32*32*32*3 {
                return Err("cc must contain 32,768 pixels")
            }
            let sampler = |c: u8| {
                // 0-255 -> 0-31
                let f = c as f64 / 255.0 * 31.0;
                let floor = f64::floor(f) as usize;
                let ceil  = f64::ceil(f) as usize;
                let percent = f64::fract(f);
                (floor, ceil, percent)
            };
            let get_offset = |r: usize, g: usize, b: usize|{
                r + b*32 + g*1024
            };
            let apply_cc_impl = |channels: &mut[u8]|{
                // let mut pixel = channels;
                let rs = sampler(channels[0]);
                let gs = sampler(channels[1]);
                let bs = sampler(channels[2]);
                let offset = (
                    get_offset(rs.0, gs.0, bs.0),
                    get_offset(rs.1, gs.1, bs.1)
                );
                let c1 = &cc[offset.0*3..offset.0*3+2];
                let c2 = &cc[offset.1*3..offset.1*3+2];
                c1.iter().zip(c2)
                    .enumerate()
                    .for_each(|(index, (v1, v2))|{
                        // blue is used as blend percent
                        channels[index] = f64::clamp(
                            percent * (*v1 as f64 * (1.0 - bs.2) + *v2 as f64 * bs.2) +
                            (1.0 - percent) * channels[index] as f64, 
                            0.0, 255.0
                        ) as u8
                    });
            };

            match &mut self.inner {
                DynamicImage::ImageRgba8(buffer) => {
                    buffer.pixels_mut().for_each(|pixel|{
                        apply_cc_impl(pixel.channels_mut());
                    });
                },
                DynamicImage::ImageRgb8(buffer) => {
                    buffer.pixels_mut().for_each(|pixel|{
                        apply_cc_impl(pixel.channels_mut());
                    });
                },
                _ => panic!("apply_cc only support rgb/rgba image")
            };
            Ok(())
        }
    }

    #[derive(Clone)]
    pub struct Filter {
        r: Vec<u8>,
        g: Vec<u8>,
        b: Vec<u8>,
        a: Vec<u8>,
    }

    impl Filter {
        fn from_lua(fr: Function, fg: Function, fb: Function, fa: Function) -> LuaResult<Self> {
            let r = Filter::prepare_map(fr)?;
            let g = Filter::prepare_map(fg)?;
            let b = Filter::prepare_map(fb)?;
            let a = Filter::prepare_map(fa)?;
            Ok(Filter { r, g, b, a })
        }

        #[inline]
        fn prepare_map(f: Function) -> LuaResult<Vec<u8>> {
            let mut result = Vec::with_capacity(256);
            for i in 0..256 {
                result.push(f.call(i)?);
            }
            Ok(result)
        }
    }

    impl UserData for Filter {
        fn add_methods<'lua, T: UserDataMethods<'lua, Self>>(_methods: &mut T) {
            
        }
    }

    impl UserData for Image {
        fn add_methods<'lua, T: UserDataMethods<'lua, Self>>(_methods: &mut T) {
            // return width, height
            _methods.add_method("size", |_, img, ()|{
                let mut size: [u32; 2] = [0, 0];
                size[0] = img.width;
                size[1] = img.height;
                Ok(Variadic::from_iter(size))
            });
            // get image width
            _methods.add_method("width", |_, img, ()|{
                Ok(img.width)
            });
            // get image height
            _methods.add_method("height", |_, img, ()|{
                Ok(img.height)
            });
            // crop the image, return subregion (a new image userdata)
            _methods.add_method("crop", |_, img: &Self, 
                (x, y, width, height): (u32, u32, u32, u32)|{
                let img = img.inner.crop_imm(x, y, width, height);
                Ok(Image::from_img(img))
            });
            // resize the image, return a new one
            _methods.add_method("resize", |_, img: &Self, (width, height): (u32, u32)|{
                Ok(Image::from_img(img.inner.resize(width, height, image::imageops::FilterType::Nearest)))
            });
            // clone the image
            _methods.add_method("clone", |_, img: &Self, ()|{
                Ok(Image::from_img(img.inner.clone()))
            });
            // apply an affine transform on image, return new image
            _methods.add_method("affine_transform", |_, img: &Self, 
                (width, height, matrix, resampler): (u32, u32, Vec<f64>, Resampler)|{
                let matrix = AffineTransform::from_vec(matrix);
                img.affine_transform(width, height, matrix, resampler)
                    .map_err(|e|LuaError::RuntimeError(e.to_string()))
            });
            // get pixel rgba of coord (x, y) (starts from left-top)
            _methods.add_method("get_pixel", |_, img: &Self, (x, y): (u32, u32)|{
                if x >= img.width || y >= img.height {
                    Err(LuaError::RuntimeError(format!("out of size ({}x{})", img.width, img.height)))
                }
                else{
                    let pixel = unsafe { img.inner.unsafe_get_pixel(x, y) };
                    let rgba = pixel.channels();
                    Ok(rgba.to_vec())
                } 
            });
            _methods.add_method_mut("put_pixel", |_, img: &mut Self, (x, y, pixel): (u32, u32, Vec<u8>)|{
                if x >= img.width || y >= img.height {
                    Err(LuaError::RuntimeError(format!("out of size ({}x{})", img.width, img.height)))
                }
                else {
                    let size = img.pixel_size();
                    if pixel.len() != size {
                        Err(LuaError::RuntimeError(format!("pixel size not match, expected {}, got {}", size, pixel.len())))
                    }
                    else {
                        unsafe { img.inner.unsafe_put_pixel(x, y, *Pixel::from_slice(pixel.as_slice())) }
                        Ok(())
                    }
                }
            });
            // save image to path
            _methods.add_method("save", |_, img: &Self, path: Value|{
                let path = match path.to_string() {
                    Ok(s)=> s,
                    Err(_)=> return Err(LuaError::ToLuaConversionError { from: "(lua)", to: "Path | string", message: None }),
                };
                if let Err(err) = img.save(path.as_str()) {
                    eprintln!("Failed to save image `{}` because of Error: {}", path, err);
                    Ok(false)
                }
                else {
                    Ok(true)
                }
            });
            // async save image to path
            _methods.add_method("save_async", |_, img: &Self, path: Value|{
                let path = match path.to_string() {
                    Ok(s)=> s,
                    Err(_)=> return Err(LuaError::ToLuaConversionError { from: "(lua)", to: "Path | string", message: None }),
                };
                img.save_async(path.as_str());
                Ok(())
            });
            // get png file bytes of image
            _methods.add_method("save_png_bytes", |lua: Context, img: &Self, ()|{
                lua.create_string(img.save_png_bytes().as_slice())
            });
            // get png file bytes and convert to base64
            _methods.add_method("save_png_base64", |_, img: &Self, ()|{
                use base64::prelude::*;
                Ok(BASE64_STANDARD.encode(img.save_png_bytes()))
            });
            // convert to rgba sequence
            _methods.add_method("to_bytes", |lua: Context, img: &Self, ()|{
                lua.create_string(img.inner.as_bytes())
            });
            // paste another image on this
            _methods.add_method_mut("paste", |_, img: &mut Self, (other, px, py): (AnyUserData, i64, i64)|{
                match other.borrow::<Image>() {
                    Ok(other)=> {
                        // TODO: this clone can be removed
                        img.paste(other.clone(), px, py);
                        Ok(())
                    },
                    Err(_)=> Err(LuaError::ToLuaConversionError { from: "(lua)", to: "Image", message: None })
                }
            });
            // filter rgba channels by each map function
            _methods.add_method_mut("apply_filter", |_, img: &mut Self, filter: Value|{
                match filter {
                    Value::Table(t)=> {
                        let filter = Filter::from_lua(
                            t.get::<_, Function>(1)?, 
                            t.get::<_, Function>(2)?,
                            t.get::<_, Function>(3)?,
                            t.get::<_, Function>(4)?)?;
                        img.apply_filter(&filter);
                        Ok(true)
                    },
                    Value::UserData(u)=> {
                        let filter = u.borrow::<Filter>()?;
                        img.apply_filter(&filter);
                        Ok(true)
                    },
                    _=> Err(LuaError::FromLuaConversionError { from: "(lua)", to: "table|Filter", message: None })
                }
            });
            // apply dontstarve colour_cube on image
            _methods.add_method_mut("apply_cc", |_, img: &mut Self, (cc, percent): (LuaString, f64)|{
                img.apply_cc(cc.as_bytes(), percent).map_err(|e|LuaError::RuntimeError(e.to_string()))
            });
            _methods.add_meta_method(MetaMethod::ToString, |_, img: &Self, ()|{
                Ok(format!("Image<{}x{} {}>", img.width, img.height, img.pixelformat()))
            });
        }
    }

    impl AsRef<Image> for Image {
        fn as_ref(&self) -> &Image {
            self
        }
    }

    impl UserData for AffineTransform {
        fn add_methods<'lua, T: UserDataMethods<'lua, Self>>(_methods: &mut T) {
            _methods.add_method("reverse", |_, matrix: &Self, ()|{
                Ok(matrix.reverse())
            });
            _methods.add_method("point", |_, matrix: &Self, (x, y): (f64, f64)|{
                let (x, y) = matrix.onpoint(x, y);
                Ok(Variadic::from_iter([x, y]))
            });
            _methods.add_meta_method(MetaMethod::ToString, |_, matrix: &Self, ()|{
                Ok(format!("Matrix<[{:.1}, {:.1}, {:.1}, {:.1}, {:.1}, {:.1}]>",
                    matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty))
            });
            _methods.add_meta_method(MetaMethod::Mul, |_, matrix: &Self, rhs: AnyUserData|{
                match rhs.borrow::<AffineTransform>() {
                    Ok(rhs)=> Ok(matrix.mult_with(&rhs)),
                    Err(e)=> Err(e)
                }
            });
        }
    }

    struct ElementTaskData {
        width: u32,
        height: u32,
        img: Image,
        matrix: AffineTransform,
        filter: Option<Filter>,

        task_id: String,
        worker_id: usize,
    }

    struct CompositeTaskData {
        canvas: Image,
        index: usize,
        /// element image, px, py (paste position may be nagative)
        elements: Vec<(Image, i64, i64)>,

        worker_id: usize,
    }

    pub fn init(lua_ctx: Context) -> LuaResult<()> {
        let table = lua_ctx.create_table()?;
        table.set("Open", lua_ctx.create_function(|_, path: String|{
            Image::open(&path).map_err(|e| LuaError::RuntimeError(e.to_string()))
        })?)?;  
        table.set("From_RGBA", lua_ctx.create_function(|_, (data, width, height): (LuaString, u32, u32)|{
            Ok(Image::from_rgba(Vec::from(data.as_bytes()), width, height))
        })?)?;
        table.set("From_RGB", lua_ctx.create_function(|_, (data, width, height): (LuaString, u32, u32)|{
            Ok(Image::from_rgb(Vec::from(data.as_bytes()), width, height))
        })?)?;
        table.set("Affine", lua_ctx.create_function(|_, vec: Vec<f64>|{
            Ok(AffineTransform::from_vec(vec))
        })?)?;
        table.set("GifWriter", lua_ctx.create_function(|_, _path: String| -> LuaResult<()>{
            unreachable!("Rust GifWriter is removed");
            // GifWriter::new(&path).map_err(|e|LuaError::RuntimeError(e.to_string()))
        })?)?;
        table.set("MultiThreadedTransform", lua_ctx.create_function(|lua, tasks: Table|{
            // type tasks = {
            //    [K:task-id]: task, 
            //    "@thread": int, 
            //    "@resampler": int, 
            //    "@progress": function(current, total, percent)}
            //
            // type task = {
            //   id: string,
            //   img: Image, width, height, matrix
            // }
            let num_threads = tasks.get::<_, usize>("@thread")
                .unwrap_or_else(|_|num_cpus::get())
                .clamp(1, 64);
            println!("[MultiThreadedTransform] spawn {} threads", num_threads);
            let onprogress = tasks.get::<_, Option<Function>>("@progress")?;
            let resampler = tasks.get::<_, Resampler>("@resampler")
                .unwrap_or(Resampler::Bilinear);
            let mut threads = Vec::with_capacity(num_threads);
            let mut keys = tasks.clone().pairs::<String, _>()
                .map(|pair|pair.unwrap_or(("".to_string(), lua.create_table().unwrap())).0.to_string())
                .filter(|v|v.starts_with("task"))
                .collect::<Vec<String>>();
            let total = keys.len();
            let (main_tx, main_rx) = sync_channel::<ElementTaskData>(1);
            #[allow(unused_variables)]
            for i in 0..num_threads {
                let main_tx = main_tx.clone();
                let (tx, rx) = sync_channel::<ElementTaskData>(1);
                threads.push((spawn(move ||{
                    loop {
                        let mut task = match rx.recv() {
                            Ok(task)=> task,
                            Err(_)=> return, // function returned, channel closed
                        };
                        // println!("WORKER {} <-", i);
                        task.img = task.img.affine_transform(task.width, task.height, task.matrix, resampler).unwrap();
                        if let Some(filter) = task.filter {
                            task.img.apply_filter(&filter);
                            task.filter = None;
                        }
                        // println!("WORKER {} ->", i);
                        if main_tx.send(task).is_err() { // function returned, silently exit worker thread
                            break;
                        }
                    }
                }), tx, true)) // thread, sender, is_available
            }
   
            loop {
                for (i, (_, tx, is_available)) in threads.iter_mut().enumerate() {
                    if *is_available && !keys.is_empty() {
                        let key = keys.pop().unwrap();
                        let task = tasks.get::<_, Table>(key.as_str())?;
                        *is_available = false;
                        if tx.send(ElementTaskData{
                            width: task.get("render_width")?,
                            height: task.get("render_height")?,
                            img: task.get::<_, AnyUserData>("img")?
                                .borrow::<Image>()?
                                .clone(),
                            matrix: AffineTransform::from_vec(task.get("matrix")?),
                            filter: match task.get::<_, Option<AnyUserData>>("filter")? {
                                Some(filter)=> Some(filter.borrow::<Filter>()?.clone()),
                                None=> None,
                            },
                            task_id: key.clone(),
                            worker_id: i,
                        }).is_err() {
                            return Err(LuaError::RuntimeError("thread panic".into()));
                        }
                    }
                }
                while let Ok(task) = main_rx.try_recv() {
                    let idle = &mut threads[task.worker_id].2;
                    if *idle {
                        return Err(LuaError::RuntimeError(format!("received task data from idle worker: {}", task.worker_id)));
                    }
                    *idle = true;
                    tasks.get::<_, Table>(task.task_id)?
                        .set("img", task.img)?;
                }
                if let Some(ref onprogress) = onprogress {
                    let current = total - keys.len();
                    onprogress.call((current, total, current as f64 / total as f64))?;
                }
                if keys.is_empty() && !threads.iter().any(|v|!v.2) {
                    break;
                }
            }
            Ok(())
        })?)?;

        table.set("MultiThreadedCompositeAndRender", lua_ctx.create_function(|_, tasks: Table|{
            // type tasks = {
            //    [I: usize]: task, 
            //    "@numframe" : usize,
            //    "@thread": int,
            //    "@encoder": function(img, index)
            //    "@sequential": boolean
            //    "@progress": function(current, total, percent)}
            //
            let num_threads = tasks.get::<_, usize>("@thread")
                .unwrap_or_else(|_|num_cpus::get())
                .clamp(1, 64);
            println!("[MultiThreadedCompositeAndRender] spawn {} threads", num_threads);
            let onprogress = tasks.get::<_, Option<Function>>("@progress")?;
            let encoder = tasks.get::<_, Function>("@encoder")?;
            let canvas = tasks.get::<_, AnyUserData>("@canvas")?;
            let canvas = canvas.borrow::<Image>()?;
            let sequential = tasks.get::<_, bool>("@sequential")?;
            let current_index = Arc::new(Mutex::new(1_usize)); // Lua table index starts at 1
            let total = tasks.get::<_, usize>("@numframe")?;
            let mut keys = (1..=total).rev().collect::<Vec<usize>>(); 
            let cond = Arc::new(Condvar::new());
            let mut threads = Vec::with_capacity(num_threads);
            let (main_tx, main_rx) = sync_channel::<CompositeTaskData>(1);
            #[allow(unused_variables)]
            for i in 0..num_threads {
                let main_tx = main_tx.clone();
                let cond = Arc::clone(&cond);
                let (tx, rx) = sync_channel::<CompositeTaskData>(1);
                let current_index = Arc::clone(&current_index);
                threads.push((spawn(move||{
                    loop {
                        let mut task = match rx.recv() {
                            Ok(task)=> task,
                            Err(_)=> return, // function returned, channel closed
                        };
                        // println!("WORKER {} <-", i);
                        for (ele, x, y) in task.elements {
                            task.canvas.paste(ele, x, y);
                        }
                        task.elements = vec![];
                        // wait for sync
                        // * mp4/mov/gif encoder uses FFmpeg, so must be sequential
                        // * png encoder is not
                        let mut index = current_index.lock().unwrap();
                        while *index != task.index && sequential {
                            index = cond.wait(index).unwrap();
                        }
                        // println!("WORKER {} ->", i);
                        if main_tx.send(task).is_err() { // function returned, silently exit worker thread
                            break;
                        }
                        drop(index);
                    }
                }), tx, true)) // thread, sender, is_available
            }

            loop {
                for (i, (_, tx, is_available)) in threads.iter_mut().enumerate() {
                    if *is_available && !keys.is_empty() {
                        let key = keys.pop().unwrap();
                        let mut elements = vec![];
                        for pair in tasks.get::<_, Table>(key)?.sequence_values::<Table>() {
                            let v = pair?;
                            let img = v.get::<_, AnyUserData>("img")?.borrow::<Image>()?.clone();
                            let px = v.get::<_, i64>("px")?;
                            let py = v.get::<_, i64>("py")?;
                            elements.push((img, px, py));
                        }
                        *is_available = false;
                        if tx.send(CompositeTaskData{
                            canvas: canvas.clone(),
                            index: key,
                            elements,
                            worker_id: i,
                        }).is_err() {
                            return Err(LuaError::RuntimeError("thread panic".into()));
                        }
                    }
                }
                while let Ok(task) = main_rx.try_recv() {
                    let available = &mut threads[task.worker_id].2;
                    if *available {
                        return Err(LuaError::RuntimeError(format!("received task data from idle worker: {}", task.worker_id)));
                    }
                    *available = true;

                    if sequential {
                        let mut current_index = current_index.lock().unwrap();
                        if *current_index != task.index {
                            return Err(LuaError::RuntimeError(format!("encoder sequential failed: exp: {} - cur: {}", 
                                *current_index, task.index)));
                        }
                        *current_index += 1;
                        cond.notify_all();
                    }
                    encoder.call((task.canvas, task.index))?;
                }
                if let Some(ref onprogress) = onprogress {
                    let current = total - keys.len();
                    onprogress.call((current, total, current as f64 / total as f64))?;
                }
                if keys.is_empty() && !threads.iter().any(|v|!v.2) {
                    break;
                }
            }

            Ok(())
        })?)?;
    
        table.set("NEAREST", Resampler::Nearest as u8)?;
        table.set("BILINEAR", Resampler::Bilinear as u8)?;
        table.set("Filter", lua_ctx.create_function(|_, fns: Table|{
            Filter::from_lua(
                fns.get(1)?, 
                fns.get(2)?,
                fns.get(3)?,
                fns.get(4)?
            )
        })?)?;

        table.set("Wait", lua_ctx.create_function(|_, _: ()|{
            ASYNC_SAVER.lock().unwrap().wait();
            Ok(())
        })?)?;

        let globals = lua_ctx.globals();
        globals.set("Image", table)?;

        Ok(())
    }
}