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

extern crate proc_macro;

use std::{env, path::{self, PathBuf}};
use quote::quote;
use proc_macro::{TokenStream, Span};
use syn::{
    parse_macro_input, Result, LitStr, Token,
    parse::{Parse, ParseStream}, 
};
use walkdir::WalkDir;

#[proc_macro]
pub fn include_lua(input: TokenStream) -> TokenStream {
    parse_macro_input!(input as IncludeLua).expand()
}

struct IncludeLua(LitStr, LitStr);

impl IncludeLua {
    fn expand(self) -> TokenStream {
        let manifest_dir: PathBuf = env::var("CARGO_MANIFEST_DIR").expect("Could not locate active Cargo.toml.").into();
        let lua_dir = manifest_dir.join("src").join(self.0.value());
        let modules = WalkDir::new(&lua_dir).into_iter().filter_map(|entry| {
            match entry {
                Ok(ref entry) if entry.file_type().is_file() => {
                    let path = entry.path().strip_prefix(&lua_dir).expect("Reached file outside of lua directory.");
                    if path.extension() == Some("lua".as_ref()) {
                        let module = if path.parent().is_some() && path.file_stem().expect("Missing file name!") == &"init".as_ref() {
                            path.parent()
                                .unwrap()
                                .to_str()
                                .expect("Cannot convert file name to str")
                                .replace(path::MAIN_SEPARATOR, ".")
                        } 
                        else {
                            // Do paths with a different separator show up? If so, fix this.
                            path.to_str()
                                .expect("Cannot convert file name to str")
                                .replace(path::MAIN_SEPARATOR, ".")
                                .replace(".lua", "")
                        };
                        return Some((module, path.to_owned()))
                    }
                    None
                }
                Err(e) => panic!("An error occured while searching for lua modules: {}", e),
                _ => None,
            }
        });

        let add_files = modules.map(|(module, path)| {
            let module = LitStr::new(&module, Span::call_site().into());
            let real_path = LitStr::new(&PathBuf::from(&lua_dir).join(&path).to_string_lossy(), Span::call_site().into());
            let virtual_path = LitStr::new(&path.to_string_lossy(), Span::call_site().into());
            quote! {
                // files.insert(#module.to_string(), (include_str!(#real_path).to_string(), #virtual_path.to_string()))
                files.insert(#module.to_string(), 
                    (String::from_utf8(include_crypt_bytes::include_bytes_obfuscate!(#real_path).expect("Failed to decrypt lua script")).unwrap(), 
                    #virtual_path.to_string()))
            }
        });

        let name = &self.1;
        quote! { {
            extern crate include_lua as inc;

            let mut files = ::std::collections::HashMap::<String, (String, String)>::new();
            #(#add_files;)*
            inc::LuaModules::__new(files, #name)
        } }.into()
    }
}

impl Parse for IncludeLua {
    fn parse(input: ParseStream) -> Result<Self> {
        let (path_str, name) = {
            let s1: LitStr = input.parse()?;
            match input.parse::<Token![:]>() {
                Ok(_) => (input.parse()?, s1),
                Err(_) => (s1.clone(), s1),
            }
        };
        if !input.is_empty() { return Err(input.error("Unknown token in include_lua invocation!")) }
        Ok(IncludeLua(path_str, name))
    }
}