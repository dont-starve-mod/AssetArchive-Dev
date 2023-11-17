use image::io::Reader as ImageReader;
use image::codecs::gif::GifEncoder;
use image::Frame;
use rlua::{Value, FromLua, Context};
use rlua::prelude::{LuaResult, LuaError, LuaString};
use std::ops::Index;
use std::fs::File;
#[cfg(unix)]
use std::os::fd::{RawFd, AsRawFd, OwnedFd, FromRawFd};
#[cfg(windows)]
use std::os::windows::io::{RawHandle, AsRawHandle, OwnedHandle, FromRawHandle};


#[repr(C)]
#[derive(Debug)]
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
#[derive(Debug)]
struct AffineTransform {
    a: f64,
    b: f64,
    c: f64,
    d: f64,
    tx: f64,
    ty: f64,
}

impl AffineTransform {
    /// build an identity affine transform
    fn new() -> Self {
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
    fn onpointxy(&self, px: f64, py: f64) -> (f64, f64) {
        (self.tx + self.a * px + self.c * py, 
         self.ty + self.b * px + self.d * py)
    }

    /// apply affine transform on point
    fn onpoint(&self, point: Point) -> Point {
        let (x, y) = self.onpointxy(point.x, point.y);
        Point{x, y}
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

pub struct Point {
    x: f64, y: f64
}

pub mod lua_image {
    use std::time::Duration;

    use image::{DynamicImage, Pixel, Rgba, Rgb, ImageBuffer, GenericImageView, Delay, GenericImage};
    use image::ColorType;
    use rlua::{Context, AnyUserData};
    use rlua::Value;
    use rlua::{Function, MetaMethod, UserData, UserDataMethods, Variadic, Table};

    use super::*;
    pub struct Image {
        pub width: u32, 
        pub height: u32,
        inner: DynamicImage,
    }

    impl Image {
        pub fn open(path: &str) -> Result<Self, &'static str> {
            let reader = match ImageReader::open(&path) {
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
                match ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(width, height, bytes) {
                    Some(buf)=> Some(Self::from_img(DynamicImage::from(buf))),
                    None=> None,
                }
            }
        }

        fn from_rgb(bytes: Vec<u8>, width: u32, height: u32) -> Option<Self> {
            if (bytes.len() as u32) < width * height * 3 {
                None
            }
            else {
                match ImageBuffer::<Rgb<u8>, _>::from_raw(width, height, bytes) {
                    Some(buf)=> Some(Self::from_img(DynamicImage::from(buf))),
                    None=> None,
                }
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
                    let (a1, a2) = (c1[3] as f64, c2[3] as f64);
                    let mut result = c1.map2(&c2, |v1, v2| Self::normalize(
                        (v1 as f64 * a1 * percent + v2 as f64 * a2 * (1.0 - percent)) / (a1*0.5 + a2*0.5)));
                    result[3] = Self::normalize(a1 * percent + a2 * (1.0 - percent));
                    Some(result)
                },
                (Some(c1), None)=> {
                    let mut c1 = c1.clone();
                    c1[3]= Self::normalize(c1[3] as f64 * percent);
                    Some(c1)
                },
                (None, Some(c2))=> {
                    let mut c2 = c2.clone();
                    c2[3]= Self::normalize(c2[3] as f64 * (1.0 - percent));
                    Some(c2)
                },
                (None, None)=> None,
            }
        }
        /// convert float color to u8 (0-255)
        #[inline]
        fn normalize(c: f64) -> u8 {
           f64::clamp(c.round(), 0.0, 255.0) as u8
        }
        /// 对图片执行变换, 返回新的图片, 其中变换定义为一个闭包
        /// 例如: |(px, py)| -> (sx, sy)
        /// 性能可能会比较糟糕 —— 因为并未规定渲染框的范围, 会造成浪费
        /// 建议该方法仅用于测试
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

        /// 对图片执行仿射变换, 返回新的图片
        fn affine_transform(&self, width: u32, height: u32, matrix: AffineTransform, resampler: Resampler) -> Result<Self, &'static str> {
            // TODO: 进行渲染框优化
            let rev_matrix = matrix.reverse();
            if rev_matrix.is_valid() {
                let transformer = |x, y|rev_matrix.onpointxy(x as f64, y as f64);
                Ok(self.transform(width, height, transformer, resampler))
            }
            else {
                Err("Invalid affine matrix: nan")
            }
        }

        #[inline]
        pub fn save(&self, path: &str) -> image::ImageResult<()> {
            self.inner.save(path)
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
                r*1 + b*32 + g*1024
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
                        let mut channels = pixel.channels_mut();
                        apply_cc_impl(&mut channels);
                        // let rs = sampler(pixel[0]);
                        // let gs = sampler(pixel[1]);
                        // let bs = sampler(pixel[2]);
                        // let offset = (
                        //     get_offset(rs.0, gs.0, bs.0),
                        //     get_offset(rs.1, gs.1, bs.1)
                        // );
                        // let c1 = &cc[offset.0*3..offset.0*3+2];
                        // let c2 = &cc[offset.1*3..offset.1*3+2];
                        // c1.iter().zip(c2)
                        //     .enumerate()
                        //     .for_each(|(index, (v1, v2))|{
                        //         // blue is used as blend percent
                        //         pixel[index] = f64::clamp(*v1 as f64 * (1.0 - bs.2) + *v2 as f64 * bs.2, 0.0, 255.0) as u8
                        //     });
                    });
                },
                DynamicImage::ImageRgb8(buffer) => {
                    buffer.pixels_mut().for_each(|pixel|{
                        let mut channels = pixel.channels_mut();
                        apply_cc_impl(&mut channels);
                    });
                },
                _ => panic!("apply_cc only support rgb/rgba image")
            };
            Ok(())
        }
    }

    pub struct GifWriter {
        // width: Option<u32>,
        // height: Option<u32>,
        inner: GifEncoder<File>,
        #[cfg(unix)]
        fd: Option<RawFd>,
        #[cfg(windows)]
        fd: Option<RawHandle>,
        duration: u64,
    }

    unsafe impl Send for GifWriter{}

    impl GifWriter {
        fn new(path: &str) -> Result<Self, String> {
            let f = std::fs::OpenOptions::new()
                .write(true)
                .create(true)
                .open(path)
                .map_err(|e| e.to_string())?;
            #[cfg(unix)]
            let fd = f.as_raw_fd();
            #[cfg(windows)]
            let fd = f.as_raw_handle();
            let mut encoder = GifEncoder::new(f);
            encoder.set_repeat(image::codecs::gif::Repeat::Infinite).unwrap();
            Ok(GifWriter {
                inner: encoder,
                fd: Some(fd),
                duration: 3 // ~30fps
            })
        }

        #[inline]
        fn is_closed(&self) -> bool {
            self.fd.is_none()
        }
    }

    impl UserData for GifWriter {
        fn add_methods<'lua, T: UserDataMethods<'lua, Self>>(_methods: &mut T) {
            // encode one frame into gif
            _methods.add_method_mut("encode", |_, gif: &mut Self, img: AnyUserData|{
                if gif.is_closed() {
                    return Err(LuaError::RuntimeError("file is closed".to_string()));
                }
                match img.borrow::<Image>() {
                    Ok(img)=> {
                        let frame = Frame::from_parts(
                            match image::ImageBuffer::<Rgba<u8>, Vec<u8>>::from_vec(
                                img.width, img.height, img.as_bytes().to_vec()
                            ){
                                Some(buffer)=> buffer,
                                None=> return Err(LuaError::RuntimeError("failed to create image frame buffer".to_string()))
                            },
                            0,0,
                            Delay::from_saturating_duration(Duration::from_millis(gif.duration* 10))
                        );
                        gif.inner.encode_frame(frame)
                            .map_err(|e|LuaError::RuntimeError(e.to_string()))
                    },
                    Err(e)=> return Err(e),
                }
            });
            // encode one bytes frame
            _methods.add_method_mut("encode_bytes", |_, gif: &mut Self, (bytes, width, height): (LuaString, u32, u32)|{
                if gif.is_closed() {
                    return Err(LuaError::RuntimeError("file is closed".to_string()));
                }
                let frame = Frame::from_parts(
                    match image::ImageBuffer::<Rgba<u8>, Vec<u8>>::from_vec(
                        width, height, bytes.as_bytes().to_vec()
                    ){
                        Some(buffer)=> buffer,
                        None=> return Err(LuaError::RuntimeError("failed to create image frame buffer".to_string()))
                    }, 
                    0,0,
                    Delay::from_saturating_duration(Duration::from_millis(gif.duration* 10))
                );
                gif.inner.encode_frame(frame)
                    .map_err(|e|LuaError::RuntimeError(e.to_string()))
            });
            // close fd
            _methods.add_method_mut("drop", |_, gif: &mut Self, ()|{
                match gif.fd {
                    Some(fd)=> {
                        #[cfg(unix)]
                        drop(unsafe { OwnedFd::from_raw_fd(fd) });
                        #[cfg(windows)]
                        drop(unsafe { OwnedHandle::from_raw_handle(fd)});
                        // prevent second call for drop()
                        gif.fd = None;
                    },
                    None => ()
                }
                Ok(())
            });
            // set frame per second
            _methods.add_method_mut("set_duration", |_, gif: &mut Self, duration: f64|{
                gif.duration = f64::round(duration / 10.0) as u64;
                Ok(())
            });
            _methods.add_meta_method(MetaMethod::ToString, |_, gif: &Self, ()|{
                Ok(format!("GifWriter<fd={}>", match gif.fd {
                    Some(n)=> format!("{:?}", n),
                    None=> "[CLOSED]".to_string(),
                }))
            });
        }
        
    }

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
            _methods.add_method("getpixel", |_, img: &Self, (x, y): (i64, i64)|{
                if x < 0 || y < 0 || x > (u32::MAX as i64)|| y > (u32::MAX as i64) {
                    // out of type range
                    return Ok(Variadic::new());
                }
                let (x, y) = (x as u32, y as u32);
                if x >= img.width || y >= img.height {
                    // out of image size range
                    Ok(Variadic::new())
                }
                else{
                    let pixel = unsafe { img.inner.unsafe_get_pixel(x as u32, y as u32) };
                    let rgba = pixel.channels();
                    Ok(Variadic::from_iter(rgba.iter().map(|i|*i)))
                } 
            });
            // save image to path
            _methods.add_method("save", |_, img: &Self, path: String|{
                if let Err(err) = img.save(&path) {
                    eprintln!("Failed to save image `{}` because of Error: {}", path, err);
                    Ok(false)
                }
                else {
                    Ok(true)
                }
            });
            // get png file bytes of image
            _methods.add_method("save_png_bytes", |lua: Context, img: &Self, ()|{
                Ok(lua.create_string(img.save_png_bytes().as_slice())?)
            });
            // convert to rgba sequence
            _methods.add_method("to_bytes", |lua: Context, img: &Self, ()|{
                Ok(lua.create_string(img.inner.as_bytes())?)
            });
            // paste another image on this
            _methods.add_method_mut("paste", |_, img: &mut Self, (other, px, py): (AnyUserData, i64, i64)|{
                match other.borrow::<Image>() {
                    Ok(other)=> {
                        let (width, height) = (img.width as i64, img.height as i64);
                        for (x, y, pixel) in other.inner.pixels() {
                        let ox = px + x as i64;
                            let oy = py + y as i64;
                            if ox < 0 || oy < 0 || ox >= width || oy >= height {
                                continue;
                            }
                            let background = img.get_pixel(ox as u32, oy as u32).unwrap();
                            let merge = match pixel[3] {
                                255=> pixel,
                                0=> background,
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
                            if pixel[3] < 255 && pixel[3] > 0 {
                                // println!("ALPHA: {:?} {:?} -> {:?}", pixel, background, merge);
                            }
                            img.set_pixel(ox as u32, oy as u32, merge);
                        }
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

    impl UserData for AffineTransform {
        fn add_methods<'lua, T: UserDataMethods<'lua, Self>>(_methods: &mut T) {
            _methods.add_method("reverse", |_, matrix: &Self, ()|{
                Ok(matrix.reverse())
            });
            _methods.add_method("point", |_, matrix: &Self, (x, y): (f64, f64)|{
                let (x, y) = matrix.onpointxy(x, y);
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
        table.set("GifWriter", lua_ctx.create_function(|_, path: String|{
            GifWriter::new(&path).map_err(|e|LuaError::RuntimeError(e.to_string()))
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

        let globals = lua_ctx.globals();
        globals.set("Image", table)?;


        Ok(())
    }
}