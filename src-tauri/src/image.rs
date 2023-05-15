use image::io::Reader as ImageReader;
use rlua::{Value, FromLua, Context};
use rlua::prelude::{LuaResult};
use std::error::Error;
use std::ops::{Index};

/// 重采样方法
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

/// 代表一个饥荒仿射矩阵
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
    /// 构造一个identity矩阵
    fn new() -> Self {
        AffineTransform {
            a: 1.0, b: 0.0,
            c: 0.0, d: 1.0,
            tx: 0.0, ty: 0.0
        }
    }
    /// 从数组构造矩阵
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
    /// 执行平移
    fn translate(&self, tx: f64, ty: f64) -> Self {
        AffineTransform { 
            tx: self.tx + tx,  
            ty: self.ty + ty,
            ..*self 
        }
    }
    /// 和另一个矩阵相乘
    fn mult_with(&self, other: &AffineTransform) -> Self {
        let (a, b) = (self, other);
        // AffineTransform {
        //     a: a[0]*b[0]+a[1]*b[2],
        //     b: a[0]*b[1]+a[1]*b[3],
        //     c: a[2]*b[0]+a[3]*b[2],
        //     d: a[2]*b[1]+a[3]*b[3],
        //     tx: a[0]*b[4]+a[1]*b[5]+a[4],
        //     ty: a[2]*b[4]+a[3]*b[5]+a[5],
        // }
        
        AffineTransform {
            a: a.a*b.a+a.b*b.c,
            b: a.a*b.b+a.b*b.d,
            c: a.c*b.a+a.d*b.c,
            d: a.c*b.b+a.d*b.d,
            tx: a.a*b.tx+a.b*b.ty+a.tx,
            ty: a.c*b.tx+a.d*b.ty+a.ty,
        }
    }
    /// 计算逆向矩阵
    fn reverse(&self) -> Self {
        let j: f64 = self.d*self.a-self.b*self.c; // matrix adj
        AffineTransform { 
            a: self.d/j, 
            b: self.b/-j, 
            c: self.c/-j, 
            d: self.a/j, 
            tx: (self.b*self.ty-self.d*self.tx)/j, 
            ty: (self.c*self.tx-self.a*self.ty)/j
        }
        // v = m[3]*m[0]-m[1]*m[2]
        // return [i/v for i in (m[3], -m[1], -m[2], m[0], 
        //     m[1]*m[5]-m[4]*m[3], m[2]*m[4]-m[0]*m[5])]
    }   
    /// 将仿射矩阵施加在二维坐标上
    fn onpointxy(&self, px: f64, py: f64) -> (f64, f64) {
        (self.tx + self.a * px + self.c * py, 
         self.ty + self.b * px + self.d * py)
    }
    /// 将仿射矩阵施加在二维坐标点上
    fn onpoint(&self, point: Point) -> Point {
        let (x, y) = self.onpointxy(point.x, point.y);
        Point{x, y}
    }
    /// check if any NAN in matrix
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
    use std::io::Write;

    use image::{DynamicImage, Pixel, Rgba, Rgb, ImageBuffer, GenericImageView};
    use image::ColorType;
    use rlua::{Context, AnyUserData};
    use rlua::Value::Nil;
    use rlua::{Function, Lua, MetaMethod, Result, UserData, UserDataMethods, Variadic, Table};
    use rlua::String as LuaString;

    use super::*;
    pub struct Image {
        width: u32, height: u32,
        img: DynamicImage,
    }

    impl Image {
        pub fn new(path: &str) -> Option<Self> {
            let reader = match ImageReader::open(&path) {
                Ok(r)=> r,
                Err(_)=> return None,
            };
            let img = match reader.decode() {
                Ok(r)=> r,
                Err(_)=> return None,
            };
            println!("dimensions {:?}", img.dimensions());
            println!("{:?}", img.color());
            Some(Self::from_img(img))  
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

        fn from_img(img: DynamicImage) -> Self {
            Image {
                width: img.width(),
                height: img.height(),
                img
            }
        }

        fn pixelformat(&self) -> &'static str {
            match self.img.color() {
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
                Some(unsafe { self.img.unsafe_get_pixel(x, y) })
            }
        }
        fn get_pixel_f64(&self, x: u32, y: u32) -> Option<Vec<f64>> {
            if x >= self.width || y >= self.height {
                None
            }
            else {
                let color = unsafe { self.img.unsafe_get_pixel(x, y) };
                Some(color.channels()
                    .iter()
                    .map(|i| *i as f64)
                    .collect()
                )
            }
        }
        /// 对两个像素颜色进行线性混合
        fn merge_color(rgba_1: Option<Vec<f64>>, rgba_2: Option<Vec<f64>>, percent: f64) -> Option<Vec<f64>> {
            match (rgba_1, rgba_2) {
                (Some(c1), Some(c2))=> Some(c1.iter()
                    .zip(c2)
                    .map(|(x1, x2)|x1* percent + x2* (1.0-percent))
                    .collect()),
                (Some(c1), None)=> {
                    let mut c1 = c1.clone();
                    c1[3]*= percent;
                    Some(c1)
                },
                (None, Some(c2))=> {
                    let mut c2 = c2.clone();
                    c2[3]*= 1.0 - percent;
                    Some(c2)
                },
                (None, None)=> None,
            }
        }
        /// convert float color to u8 (0-255)
        fn normalize(c: f64) -> u8 
        {
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
            dbg!(&resampler);
            for (x, y, pixel) in imgbuf.enumerate_pixels_mut() {
                // 计算采样点
                let (sx, sy) = transformer(x, y);
                if sx < -4.0 || sy < -4.0 || sx > source_width as f64 + 4.0 || sy > source_height as f64 + 4.0 {
                    continue;
                }
                let sp = match resampler {
                    Resampler::Nearest => {
                        // 四舍五入获取最近的点坐标
                        let sx = f64::round(sx) as u32;
                        let sy = f64::round(sy) as u32;
                        self.get_pixel(sx, sy)
                    },
                    Resampler::Bilinear => {
                        // 获取附近的四个点位
                        let sx_left = f64::floor(sx);
                        let sx_right = sx_left + 1.0;
                        let sy_top = f64::floor(sy);
                        let sy_bottom = sy_top + 1.0;
                        // 左侧像素
                        let rgba_left = Image::merge_color(
                            self.get_pixel_f64(sx_left as u32,  sy_top as u32),
                            self.get_pixel_f64(sx_left as u32, sy_bottom as u32),
                            1.0 - (sy - sy_top));
                        // 右侧像素
                        let rgba_right = Image::merge_color(
                            self.get_pixel_f64(sx_right as u32,  sy_top as u32),
                            self.get_pixel_f64(sx_right as u32, sy_bottom as u32),
                            1.0 - (sy - sy_top));
                        // 合并
                        let rgba = Image::merge_color(
                            rgba_left,
                            rgba_right,
                            1.0 - (sx - sx_left));
                        match rgba {
                            Some(c)=> Some(Rgba([
                                Image::normalize(c[0]),
                                Image::normalize(c[1]),
                                Image::normalize(c[2]),
                                Image::normalize(c[3]),
                            ])),
                            None=> None
                        }
                    }
                };
                if let Some(color) = sp {
                    *pixel = color
                }
            }
            Self::from_img(DynamicImage::from(imgbuf))
        }

        /// 对图片执行仿射变换, 返回新的图片
        fn affine_transform(&self, width: u32, height: u32, matrix: AffineTransform, resampler: Resampler) -> Self {
            // TODO: 进行渲染框优化
            let rev_matrix = matrix.reverse();
            if rev_matrix.is_valid() {
                let transformer = |x, y|rev_matrix.onpointxy(x as f64, y as f64);
                self.transform(width, height, transformer, resampler)
            }
            else {
                // use a dummy transformer :)
                self.transform(width, height, |_, _|(f64::MAX, f64::MAX), resampler)
            }
        }

        pub fn save(&self, path: &str) -> image::ImageResult<()> {
            self.img.save(path)?;
            Ok(())
        }
    }

    impl UserData for Image {
        fn add_methods<'lua, T: UserDataMethods<'lua, Self>>(_methods: &mut T) {
            // 获取图像分辨率, 返回2个数
            _methods.add_method("size", |_, img, ()|{
                let mut size: [u32; 2] = [0, 0];
                size[0] = img.width;
                size[1] = img.height;
                Ok(Variadic::from_iter(size))
            });
            // 获取图像的宽度
            _methods.add_method("width", |_, img, ()|{
                Ok(img.width)
            });
            // 获取图像的高度
            _methods.add_method("height", |_, img, ()|{
                Ok(img.height)
            });
            // 切割图像, 返回一个新的图像
            _methods.add_method("crop", |_, img: &Self, 
                (x, y, width, height): (u32, u32, u32, u32)|{
                let img = img.img.crop_imm(x, y, width, height);
                Ok(Image::from_img(img))
            });
            _methods.add_method("affine_transform", |_, img: &Self, 
                (width, height, matrix, resampler): (u32, u32, Vec<f64>, Resampler)|{
                let matrix = AffineTransform::from_vec(matrix);
                let img = img.affine_transform(width, height, matrix, resampler);
                Ok(img)
            });
            // 获取图像某位置的像素
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
                    let pixel = unsafe { img.img.unsafe_get_pixel(x as u32, y as u32) };
                    let rgba = pixel.channels();
                    Ok(Variadic::from_iter(rgba.iter().map(|i|*i)))
                } 
            });
            // 保存图片 (调试方法)
            _methods.add_method("save", |_, img: &Self, path: String|{
                img.save(&path).unwrap_or_else(|err|{
                    eprintln!("Failed to save image `{}` because of Error: {}", path, err);
                });
                Ok(())
            });
            // 转换为png序列 (调试方法)
            _methods.add_method("save_png_bytes", |lua: Context, img: &Self, ()|{
                let mut writer = std::io::Cursor::new(Vec::<u8>::with_capacity(10000));
                image::write_buffer_with_format(&mut writer, 
                    img.img.as_bytes(), 
                    img.width, img.height, 
                    img.img.color(), 
                    image::ImageFormat::Png).unwrap();
                Ok(lua.create_string(writer.get_ref())?)
            });
            
            _methods.add_meta_method(MetaMethod::ToString, |_, img: &Self, ()|{
                Ok(format!("Image<{}x{} {}>", img.width, img.height, img.pixelformat()))
            });
        }
    }

    impl UserData for AffineTransform {
        fn add_methods<'lua, T: UserDataMethods<'lua, Self>>(_methods: &mut T) {
            _methods.add_meta_method(MetaMethod::ToString, |_, matrix: &Self, ()|{
                Ok(format!("Matrix<[{:.1}, {:.1}, {:.1}, {:.1}, {:.1}, {:.1}]>",
                    matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty))
            })
        }
    }

    pub fn init(lua_ctx: Context) -> Result<()> {
        let table = lua_ctx.create_table()?;
        table.set("Load", lua_ctx.create_function(|_, path: String|{
            Ok(Image::new(&path))
        })?)?;  
        table.set("From_RGBA", lua_ctx.create_function(|_, (data, width, height): (LuaString, u32, u32)|{
            Ok(Image::from_rgba(Vec::from(data.as_bytes()), width, height))
        })?)?;
        table.set("From_RGB", lua_ctx.create_function(|_, (data, width, height): (LuaString, u32, u32)|{
            Ok(Image::from_rgb(Vec::from(data.as_bytes()), width, height))
        })?)?;
        table.set("NEAREST", Resampler::Nearest as u8)?;
        table.set("BILINEAR", Resampler::Bilinear as u8)?;

        let globals = lua_ctx.globals();
        globals.set("Image", table)?;


        Ok(())
    }
}