pub mod lua_misc {
    use rlua::prelude::{LuaResult, LuaString};
    use rlua::{Nil, UserData, Context};
    use std::time::{SystemTime, UNIX_EPOCH};
    use indicatif::{ProgressBar, ProgressStyle};

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

        // // cmd args
        // globals.set("Args", lua_ctx.create_table_from(std::env::args()
        //     .map(|v|lua_ctx.create_string(&v).unwrap_or(Nil))
        //     .enumerate()
        // )?)?;

        Ok(())
    }
}