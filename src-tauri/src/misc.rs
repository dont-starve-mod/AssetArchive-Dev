pub mod lua_misc {
    use rlua::prelude::{LuaResult, LuaString, LuaError};
    use rlua::{Nil, UserData, Context, Value};
    use std::time::{SystemTime, UNIX_EPOCH};
    use indicatif::{ProgressBar, ProgressStyle};
    use webbrowser;

    struct Bar {
        inner: ProgressBar,
    }
    
    impl Bar {
        fn new(len: u64) -> Self {
            let inner = ProgressBar::new(len);
            inner.set_style(ProgressStyle::with_template(
                "[{elapsed}] {bar:32.green/red} {pos:>4}/{len:4} ({percent}%) {msg}")
                .unwrap()
                .progress_chars("━ ━")
            );
            Bar {
                inner
            }
        }
    }
    impl UserData for Bar {
        fn add_methods<'lua, T: rlua::UserDataMethods<'lua, Self>>(_methods: &mut T) {
            _methods.add_method_mut("inc", |_, bar: &mut Self, len: u64|{
                bar.inner.inc(len);
                Ok(Nil)
            });
            _methods.add_method_mut("set_position", |_, bar: &mut Self, pos: u64|{
                bar.inner.set_position(pos);
                Ok(Nil)
            });
            _methods.add_method("done", |_, bar: &Self, ()|{
                bar.inner.finish_with_message("done");
                Ok(Nil)
            });
        }
    }

    pub fn init(lua_ctx: Context) -> LuaResult<()> {
        use crate::image::lua_image::Image;

        let globals = lua_ctx.globals();
        // progress bar printer
        globals.set("ProgressBar", lua_ctx.create_function(|_, len: u64|{
            Ok(Bar::new(len))
        })?)?;
        // timestamp
        globals.set("now", lua_ctx.create_function(|_, ()|{
            let time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis();
            Ok(time)
        })?)?;
        // clipboard writing
        let clipboard = lua_ctx.create_table()?;
        clipboard.set("WriteImage", lua_ctx.create_function(|_, img: Value|{
            match img {
                Value::UserData(v)=> {
                    if let Ok(v) = v.borrow::<Image>() {
                        let mut clipboard = clippers::Clipboard::get();
                        match clipboard.write_image(v.width, v.height, v.as_bytes()) {
                            Ok(())=> Ok(true),
                            Err(e)=> Err(LuaError::RuntimeError(format!("Failed to write image to clipboard: {:?}", e)))
                        }
                    }
                    else {
                        Err(LuaError::RuntimeError("Type is not image".to_string()))
                    }
                },
                _ => Err(LuaError::RuntimeError("Type is not image".to_string()))
            }
        })?)?;
        clipboard.set("WriteImage_Bytes", lua_ctx.create_function(|_, (bytes, width, height): (LuaString, u32, u32)|{
            let mut clipboard = clippers::Clipboard::get();
            match clipboard.write_image(width, height, bytes.as_bytes()) {
                Ok(())=> Ok(true),
                Err(e)=> Err(LuaError::RuntimeError(format!("Failed to write image to clipboard: {:?}", e)))
            }
        })?)?;
        clipboard.set("WriteText", lua_ctx.create_function(|_, text: String|{
            let mut clipboard = clippers::Clipboard::get();
            match clipboard.write_text(&text) {
                Ok(())=> Ok(true),
                Err(e)=> Err(LuaError::RuntimeError(format!("Failed to write string to clipboard: {:?}", e)))
            }
        })?)?;
        globals.set("Clipboard", clipboard)?;

        // webbrowser
        globals.set("OpenURL", lua_ctx.create_function(|_, url: String|{
            Ok(webbrowser::open(url.as_str()).is_ok())
        })?)?;

        // select file
        globals.set("SelectFileInFolder", lua_ctx.create_function(|_, path: String|{
            use std::process;
            #[cfg(unix)]
            Ok(process::Command::new("/usr/bin/open")
                .arg("-R")
                .arg(path)
                .status()
                .is_ok())
        })?)?;

        // process
        globals.set("exit", lua_ctx.create_function(|_, code: Value| -> Result<(), LuaError>{
            let code = match code {
                Value::Nil=> 0,
                Value::Number(n)=> n as i32,
                _=> 1,
            };
            std::process::exit(code);
        })?)?;

        Ok(())
    }
}