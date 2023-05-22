pub mod lua_misc {
    use rlua::prelude::{LuaString, LuaResult};
    use rlua::{Nil, UserData, Context};
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
            // _methods.add_method("print", |_, bar: &Self, ()|{
            //     bar.inner.inc_length(delta)
            // })
        }
    }

    pub fn init(lua_ctx: Context) -> LuaResult<()> {
        let globals = lua_ctx.globals();
        globals.set("ProgressBar", lua_ctx.create_function(|_, len: u64|{
            Ok(Bar::new(len))
        })?)?;
        Ok(())
    }
}