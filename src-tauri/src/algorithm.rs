pub mod lua_algorithm {
    use std::io::Cursor;
    use std::sync::Mutex;
    use rlua::{Context, Value};
    use rlua::Result as LuaResult;
    use rlua::String as LuaString;
    use rlua::Error as LuaError;
    use sevenz_rust::decompress_with_extract_fn;
    use zune_inflate::{DeflateDecoder, errors::InflateDecodeErrors};
    use miniz_oxide::inflate::decompress_to_vec;
    use miniz_oxide::deflate::compress_to_vec;
    // use libdeflater::Decompressor;

    // #[inline]
    // fn deflate(compressed_data: &[u8]) -> Result<Vec<u8>, InflateDecodeErrors> {
    //     let mut decoder = DeflateDecoder::new(compressed_data);
    //     match decoder.decode_deflate() {
    //         Ok(raw_data)=> Ok(raw_data),
    //         Err(e)=> {
    //             eprintln!("Failed to decompress: {:?}", e);
    //             Err(e)
    //         },
    //     }
    // }

    // #[inline]
    // fn deflate(compressed_data: &[u8]) -> Result<Vec<u8>, String> {
    //     let mut buf = Vec::<u8>::new();
    //     match Decompressor::new().deflate_decompress(compressed_data, &mut buf) {
    //         Ok(_)=> Ok(buf),
    //         Err(e)=> { println!("{:?}", e); Err(e.to_string()) }
    //     }
    // }

    #[inline]
    fn deflate(compressed_data: &[u8]) -> Result<Vec<u8>, String> {
        decompress_to_vec(compressed_data).map_err(|e|e.to_string())
    }

    #[inline]
    fn inflate(raw_data: &[u8], level: Option<u8>) -> Result<Vec<u8>, String> {
        Ok(compress_to_vec(raw_data, level.unwrap_or(8)))
    }


    fn sevenz_decompress(compressed_data: &[u8], ) -> Result<Vec<u8>, String> {
        let f = Cursor::new(compressed_data);
        let buf = Vec::with_capacity(85*1000*1000);
        let mt = Mutex::new(buf);
        decompress_with_extract_fn(f, "", |entry, reader, _|{
            if entry.name().ends_with("/ffmpeg.exe") {
                // TODO: make this generic
                reader.read_to_end(mt.lock().unwrap().as_mut()).ok();
            }
            Ok(true)
        }).ok();
        let lock = mt.lock().unwrap();
        Ok(lock.as_slice().to_vec())
    }

    #[inline]
    fn dxt5_decompress(compressed_data: &[u8], width: usize, height: usize) -> Vec<u8> {
        match bcndecode::decode(compressed_data, width, height,
            bcndecode::BcnEncoding::Bc3, // DXT5
            bcndecode::BcnDecoderFormat::RGBA) {
            Ok(buf)=> buf,
            Err(_)=> vec![]
        }
    }

    #[inline]
    fn dxt1_decompress(compressed_data: &[u8], width: usize, height: usize) -> Vec<u8> {
        match bcndecode::decode(compressed_data, width, height,
            bcndecode::BcnEncoding::Bc1, // DXT1
            bcndecode::BcnDecoderFormat::RGBA) {
            Ok(buf)=> buf,
            Err(_)=> vec![]
        }
    }

    #[inline]
    fn flip_bytes(bytes: &[u8], linewidth: usize) -> Vec<u8> {
        bytes.rchunks_exact(linewidth)
            .collect::<Vec<&[u8]>>()
            .concat()
    }
    
    #[inline]
    fn kleihash(bytes: &[u8]) -> u32 {
        bytes.iter().fold::<u64, _>(0, |hash, x|{
            let x = match *x as u64 {
                n @ 65..=90 => n + 32,
                n if n > 127 => n + 0xFFFFFF00,
                n => n
            };
            (x + (hash << 6) + (hash << 16) - hash) & 0xFFFFFFFF
        })
            as u32
    }

    #[allow(clippy::too_many_arguments)]
    #[inline]
    fn crop_bytes(bytes: &[u8], width: usize, height: usize,
        x: usize, y: usize, cw: usize, ch: usize, pixel_size: usize) -> Result<Vec<u8>, String> {
        if bytes.len() != width* height* pixel_size {
            Err(format!("Invalid input sequence ({} <-> {}x{}x{} = {})", 
                bytes.len(), width, height, pixel_size, width*height*pixel_size))
        }
        else if x + cw > width || y + ch > height {
            Err("Rect out of bound".to_string())
        }
        else {
            let mut result = Vec::<u8>::with_capacity(cw*ch*pixel_size);
            for py in y..y + ch {
                let start = (py* width + x)* pixel_size;
                result.extend_from_slice(&bytes[start..start+cw*pixel_size]);
            }
            assert!(result.len() == cw*ch*pixel_size);
            Ok(result)
        }
    }

    #[inline]
    fn mult_alpha_impl(v: u8, a: u8) -> u8 {
        match a {
            0 => 0,
            255 => v,
            a => ((v as u32 * a as u32 + a as u32)>> 8) as u8,
            #[allow(unreachable_patterns)]
            a => f32::clamp((v as f32)* (a as f32)/255.0, 0.0, 255.0) as u8
        }
    }

    #[inline]
    fn mult_alpha(bytes: &[u8]) -> Vec<u8> {
        bytes.chunks_exact(4)
            .map(|color|[
                mult_alpha_impl(color[0], color[3]),
                mult_alpha_impl(color[1], color[3]),
                mult_alpha_impl(color[2], color[3]),
                color[3]
            ])
            .collect::<Vec<_>>()
            .concat()
    }

    #[inline]
    fn div_alpha_and_clamp(v: u8, a: u8) -> u8 {
        match a {
            0 => 0,
            255 => v,
            a => f32::clamp((v as f32)/ (a as f32)*255.0, 0.0, 255.0) as u8
        }
    }

    #[inline]
    fn div_alpha(bytes: &[u8]) -> Vec<u8> {
        bytes.chunks_exact(4)
            .map(|color|[
                div_alpha_and_clamp(color[0], color[3]),
                div_alpha_and_clamp(color[1], color[3]),
                div_alpha_and_clamp(color[2], color[3]),
                color[3]
            ])
            .collect::<Vec<_>>()
            .join(&[][..])
    }

    #[test]
    fn check_hash() {
        let smallhash = |s: &str| kleihash(s.as_bytes());
        assert_eq!(smallhash("DontStarve"), 2178190994);
        assert_eq!(smallhash("老王天天写bug"), 3695745239);   
        kleihash(&vec![0,0,0]); 
        kleihash(&vec![255,255,255,255]); 
    }

    pub fn init(lua_ctx: Context) -> LuaResult<()>{
        let table = lua_ctx.create_table()?;
        table.set("Deflate", lua_ctx.create_function(|lua_ctx: Context, compressed_data: LuaString|{
            match deflate(compressed_data.as_bytes()) {
                Ok(raw_data) => Ok(Some(Value::String(lua_ctx.create_string(&raw_data[..])?))),
                Err(_) => Ok(None)
            }
        })?)?;
        table.set("Inflate", lua_ctx.create_function(|lua_ctx: Context, (raw_data, level): (LuaString, Option<u8>)|{
            match inflate(raw_data.as_bytes(), level) {
                Ok(compressed_data) => Ok(Some(Value::String(lua_ctx.create_string(&compressed_data[..])?))),
                Err(_) => Ok(None)
            }
        })?)?;

        table.set("Sevenz_Decompress", lua_ctx.create_function(|lua_ctx: Context, compressed_data: LuaString|{
            lua_ctx.create_string(sevenz_decompress(compressed_data.as_bytes()).unwrap().as_slice())
        })?)?;
        table.set("DXT5_Decompress", lua_ctx.create_function(|lua_ctx: Context, 
            (compressed_data, width, height): (LuaString, usize, usize)|{
            lua_ctx.create_string(&dxt5_decompress(compressed_data.as_bytes(), width, height))
        })?)?;
        table.set("DXT1_Decompress", lua_ctx.create_function(|lua_ctx: Context,
            (compressed_data, width, height): (LuaString, usize, usize)|{
            lua_ctx.create_string(&dxt1_decompress(compressed_data.as_bytes(), width, height))
        })?)?;
        table.set("SmallHash_Impl", lua_ctx.create_function(|_, s: LuaString|{
            Ok(kleihash(s.as_bytes()))
        })?)?;
        table.set("CropBytes", lua_ctx.create_function(|lua: Context,
            (bytes, width, height, x, y, cw, ch, pixel_size): (LuaString, usize, usize, usize, usize, usize, usize, Option<usize>)|{
            const DEFAULT_PIX_SIZE: usize = 4;
            crop_bytes(bytes.as_bytes(), width, height, x, y, cw, ch, pixel_size.unwrap_or(DEFAULT_PIX_SIZE))
                .map(|r|lua.create_string(r.as_slice()))
                .map_err(LuaError::RuntimeError)
        })?)?;
        table.set("FlipBytes", lua_ctx.create_function(|lua: Context,
            (bytes, linewidth): (LuaString, usize)|{
            lua.create_string(&flip_bytes(bytes.as_bytes(), linewidth))
        })?)?;
        table.set("MultAlpha", lua_ctx.create_function(|lua: Context, bytes: LuaString|{
            lua.create_string(&mult_alpha(bytes.as_bytes()))
        })?)?;
        table.set("DivAlpha", lua_ctx.create_function(|lua: Context, bytes: LuaString|{
            lua.create_string(&div_alpha(bytes.as_bytes()))
        })?)?;
        table.set("Min", lua_ctx.create_function(|_, table: rlua::Table<'_>|{
            let len = table.len()?;
            if len == 0 {
                Err(LuaError::RuntimeError("table len is 0".to_string()))
            }
            else {
                let mut result = f64::MAX;
                for pair in table.pairs::<usize, f64>() {
                    let (_, value) = pair?;
                    result = f64::min(result, value);
                }
                Ok(result)
            }
        })?)?;
        table.set("Max", lua_ctx.create_function(|_, table: rlua::Table<'_>|{
            let len = table.len()?;
            if len == 0 {
                Err(LuaError::RuntimeError("table len is 0".to_string()))
            }
            else {
                let mut result = -f64::MAX;
                for pair in table.pairs::<usize, f64>() {
                    let (_, value) = pair?;
                    result = f64::max(result, value);
                }
                Ok(result)
            }
        })?)?;
        table.set("Bits", lua_ctx.create_function(|_, (bytes, start, len): (LuaString, u128, u128)|{
            let bytes = bytes.as_bytes();
            if bytes.len() > 16 {
                Err(LuaError::RuntimeError("bytes length must be not bigger than 8".to_string()))
            }
            else {
                let mut buffer = [0; 16];
                buffer[0..bytes.len()].clone_from_slice(bytes);
                let value = u128::from_le_bytes(buffer);
                let stop = start + len;
                Ok((value & ((1 << stop) - 1)) >> start)
            }
        })?)?;

        lua_ctx.globals().set("Algorithm", table)?;
    
        Ok(())
    }
}