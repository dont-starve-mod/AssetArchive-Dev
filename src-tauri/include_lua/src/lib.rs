// https://github.com/AlphaModder/include-lua

// MIT License

// Copyright (c) 2019 AlphaModder

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

use rlua::{Result, Context, UserData, UserDataMethods, MetaMethod, Value, Table, RegistryKey};
use std::collections::HashMap;
/// Represents a Lua source tree embedded into a binary via [`include_lua!`][include_lua].
pub struct LuaModules {
    files: HashMap<String, (String, String)>,
}

impl LuaModules {
    #[doc(hidden)]
    pub fn __new(files: HashMap<String, (String, String)>, _prefix: &str) -> LuaModules {
        LuaModules { files }
    }
}

/// A piece of [`UserData`][UserData] that acts like a Lua searcher.
/// When called as a function with a single string parameter, attempts to load
/// (but not execute) a module by that name. If no module is found, returns nil.
pub struct Searcher(LuaModules, RegistryKey);

impl UserData for Searcher {
     fn add_methods<'lua, M: UserDataMethods<'lua, Self>>(methods: &mut M) {
        methods.add_meta_method(MetaMethod::Call, |ctx, this, value: String| {
            Ok(match this.0.files.get(&value) {
                Some((source, path)) => {
                    Value::Function(ctx.load(source)
                        .set_name(path)?
                        .set_environment(ctx.registry_value::<Table>(&this.1)?)?
                        .into_function()?
                    )
                }
                None => Value::Nil,
            })
        });
        methods.add_method("get_source", |ctx, this, value: String| {
            // dbg!(&this.0.files.keys());
            match this.0.files.get(&value) {
                Some((source, _))=> ctx.create_string(source),
                None => ctx.create_string(""),
            }
        });
    }
}

/// An extension trait for [`Context`][Context] that allows the loading of [`LuaModules`][LuaModules] instances.
pub trait ContextExt<'a> {
    /// Makes the source tree represented by `modules` accessible to `require` calls within this context.
    fn add_modules(&self, modules: LuaModules) -> Result<()>;

    /// Makes the source tree represented by `modules` accessible to `require` calls within this context.
    /// All modules loaded from the source tree will have their environment set to `environment`.
    fn add_modules_with_env(&self, modules: LuaModules, environment: Table<'a>) -> Result<()>;

    /// Creates a [`Searcher`][Searcher] instance from the given [`LuaModules`][LuaModules] instance.
    fn make_searcher(&self, modules: LuaModules) -> Result<Searcher>;

    /// Creates a [`Searcher`][Searcher] instance from the given [`LuaModules`][LuaModules] instance.
    /// All modules loaded by the searcher will have their environment set to `environment`.
    fn make_searcher_with_env(&self, modules: LuaModules, environment: Table<'a>) -> Result<Searcher>;
}

impl<'a> ContextExt<'a> for Context<'a> {
    fn add_modules(&self, modules: LuaModules) -> Result<()> {
        self.add_modules_with_env(modules, self.globals())
    }

    fn add_modules_with_env(&self, modules: LuaModules, environment: Table<'a>) -> Result<()> {
        // lua5.1 - package.loaders *
        // lua5.3 - package.seachers
        let loaders: Table = self.globals().get::<_, Table>("package")?.get("loaders")?;
        loaders.set(loaders.len()? + 1, self.make_searcher_with_env(modules, environment)?)
    }

    fn make_searcher(&self, modules: LuaModules) -> Result<Searcher> {
        self.make_searcher_with_env(modules, self.globals())
    }

    fn make_searcher_with_env(&self, modules: LuaModules, environment: Table<'a>) -> Result<Searcher> {
        Ok(Searcher(modules, self.create_registry_value(environment)?))
    }
}