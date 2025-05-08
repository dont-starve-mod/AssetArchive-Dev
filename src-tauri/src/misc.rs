pub mod lua_misc {
    use rlua::prelude::{LuaResult, LuaString, LuaError};
    use rlua::{Nil, UserData, Context, Value, Table};
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
        // time
        globals.set("now", lua_ctx.create_function(|_, ()|{
            let time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis();
            Ok(time)
        })?)?;
        globals.set("now_s", lua_ctx.create_function(|_, ()|{
            let time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs_f64();
            Ok(time)
        })?)?;
        globals.set("debug_sleep", lua_ctx.create_function(|_, secs: f64|{
            std::thread::sleep(std::time::Duration::from_secs_f64(secs));
            Ok(())
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

        globals.set("PPrintAsHex", lua_ctx.create_function(|_, content: LuaString|{
            use hex_pp::pretty_hex_write;
            let mut s = String::new();
            pretty_hex_write(&mut s, &content.as_bytes()).map_err(
                |e| LuaError::RuntimeError(format!("Failed to pretty print hex: {:?}", e))
            )?;
            Ok(s)
        })?)?;

        // select file
        #[cfg(r#false)]
        {
        #[cfg(unix)]
        globals.set("SelectFileInFolder", lua_ctx.create_function(|_, path: Value|{
            use std::process;
            use crate::filesystem::lua_filesystem::Path;

            let path = match path {
                Value::String(s)=> s.to_str()?.to_string(),
                Value::UserData(data)=> {
                    let path = data.borrow::<Path>()?;
                    path.to_string()
                },
                _ => return Ok(false)
            };
            Ok(process::Command::new("/usr/bin/open")
                .arg("-R")
                .arg(path.as_str())
                .status()
                .is_ok())
        })?)?;

        #[cfg(target_os="windows")]
        globals.set("SelectFileInFolder", lua_ctx.create_function(|_, path: String|{
            use crate::select::select_handler::windows_select_file_in_folder;
            let success = windows_select_file_in_folder(path);
            Ok(success)
        })?)?;

        #[cfg(target_os="windows")]
        globals.set("EverythingSearch", lua_ctx.create_function(|_, path: String|{
            use crate::es::es_handler::search;
            Ok(search(path.as_str()))
        })?)?;
        }

        // validate utf-8 and ascii
        let string_lib = globals.get::<_, Table>("string")?;
        string_lib.set("is_ascii", lua_ctx.create_function(|_, s: LuaString|{
            if let Ok(s) = s.to_str() {
                Ok(s.is_ascii())
            }
            else {
                Ok(false)
            }
        })?)?;
        string_lib.set("is_utf8", lua_ctx.create_function(|_, s: LuaString|{
            Ok(s.to_str().is_ok())
        })?)?;
        string_lib.set("get_utf8_last_valid_index", lua_ctx.create_function(|_, s: LuaString|{
            let s = s.as_bytes();
            match std::str::from_utf8(s) {
                Ok(_)=> Ok(s.len()),
                Err(e)=> Ok(e.valid_up_to())
            }
        })?)?;
        string_lib.set("to_utf8_lossy", lua_ctx.create_function(|lua, s: LuaString|{
            let s = String::from_utf8_lossy(s.as_bytes()).to_string();
            lua.create_string(&s)
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

        // cli input
        globals.set("input", lua_ctx.create_function(|_, prompt: String|{
            use std::io::{self, Write};
            print!("{}", prompt);
            io::stdout().flush().unwrap();
            let mut input = String::new();
            io::stdin().read_line(&mut input).unwrap();
            Ok(input.trim().to_string())
        })?)?;

        Ok(())
    }
}