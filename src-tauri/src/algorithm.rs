pub mod lua_algorithm {
    use rlua::{Context, Value};
    use rlua::Result as LuaResult;
    use rlua::String as LuaString;
    use zune_inflate::DeflateDecoder;
    use zune_inflate::errors::InflateDecodeErrors;

    fn deflate(compressed_data: &[u8]) -> Result<Vec<u8>, InflateDecodeErrors> {
        let mut decoder = DeflateDecoder::new(compressed_data);
        match decoder.decode_deflate() {
            Ok(raw_data)=> Ok(raw_data),
            Err(e)=> {
                eprintln!("Failed to decompress: {:?}", e);
                Err(e)
            },
        }
    }

    fn dxt5_decompress(compressed_data: &[u8], width: usize, height: usize) -> Vec<u8> {
        match bcndecode::decode(compressed_data, width, height,
            bcndecode::BcnEncoding::Bc3, // DXT5
            bcndecode::BcnDecoderFormat::RGBA) {
            Ok(buf)=> buf,
            Err(_)=> vec![]
        }
    }

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
        table.set("DXT5_Decompress", lua_ctx.create_function(|lua_ctx: Context, 
            (compressed_data, width, height): (LuaString, usize, usize)|{
            Ok(lua_ctx.create_string(&dxt5_decompress(compressed_data.as_bytes(), width, height)))
        })?)?;
        table.set("SmallHash_Impl", lua_ctx.create_function(|_, s: LuaString|{
            Ok(kleihash(s.as_bytes()))
        })?)?;

        let globals = lua_ctx.globals();
        globals.set("Algorithm", table)?;
        Ok(())
    }
}