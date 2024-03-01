use clap::{arg, Arg, ArgAction};
use rlua::{UserData, Value, MetaMethod, Context};
use rlua::prelude::{LuaError, LuaResult};

pub mod lua_args {
    use super::*;
    struct Args {
        inner: clap::ArgMatches,
        exec: String,
    }

    fn convert_to_luastring<'lua>(lua: Context<'lua>, s: Option<&str>) -> LuaResult<Value<'lua>> {
        match s {
            Some(s)=> match lua.create_string(s) {
                Ok(s)=> Ok(Value::String(s)),
                Err(e)=> Err(e)
            },
            None => Ok(Value::Nil),
        }
    }

    impl Args {
        fn new() -> Self { 
            let generic_args = [
                Arg::new("verbose")
                    .value_name("LEVEL")
                    .short('v')
                    .value_parser(["2", "1", "0"])
                    .default_value("1")
                    .help("输出信息详细程度, 2: 详细, 1: 默认, 0: 无"),
                Arg::new("game_data_directory")
                    .value_name("PATH")
                    .long("game-data-directory")
                    .help("显式指定游戏资源根目录路径")
            ];
            let index_args = [
                Arg::new("force_index")
                    .long("force-index")
                    .action(ArgAction::SetTrue)
                    .help("忽略缓存, 强制进行资源索引, 会显著增加耗时, 不建议使用")
            ];
            let matches = clap::Command::new("Asset Archive CLI")
                .author("老王天天写bug")
                .about("饥荒资源档案 - 命令行工具 (Asset Archive CLI)")
                .subcommand(clap::Command::new("dummy")
                    .about("快速测试路径参数")
                    .visible_aliases(["d"])
                    .args(generic_args.clone()))
                .subcommand(clap::Command::new("compile")
                    .about("编译静态注释文件")
                    .visible_aliases(["c"])
                    .args(generic_args.clone())
                    .args([
                        Arg::new("skip_analyzing")
                            .long("skip-analyzing")
                            .short('a')
                            .action(ArgAction::SetTrue)
                            .help("跳过prefab loading分析步骤, 缩短总时长")
                    ])
                    .args(index_args.clone())
                )
                .subcommand(clap::Command::new("render-animation")
                    .about("渲染动画, 生成图片序列/视频/动图")
                    .visible_aliases(["animation", "anim", "a", "r"])
                    .args(generic_args.clone())
                    .args([
                        arg!(--bank <BANK> "SetBank, 设置动画库名").required(true),
                        arg!(--build <BUILD> "SetBuild, 设置材质名").required(true),
                        arg!(-a --animation <ANIMATION> "PlayAnimation, 设置动画名").required(true),
                        arg!(-f --facing <FACING> "SetFacing, 设置动画朝向"),
                        arg!(-o <BUILD> "AddOverrideBuild, 添加材质覆盖")
                            .long("override-build"),
                        Arg::new("overryde_symbol")
                            .value_names(["SYMBOL", "BUILD", "SYMBOL"])
                            .long("override-symbol")
                            .help("OverrideSymbol, 覆盖符号")
                            .num_args(2..=3),
                        Arg::new("clear_override_build")
                            .value_name("BUILD")
                            .long("clear-override-build")
                            .aliases(["clearoverridebuild"])
                            .help("ClearOverrideBuild, 清除覆盖材质"),
                        Arg::new("clear_override_symbol")
                            .value_name("SYMBOL")
                            .long("clear-override-symbol")
                            .aliases(["clearoverridesymbol"])
                            .help("ClearOverrideSymbol, 清除覆盖符号"),
                        Arg::new("hide_symbol")
                            .value_name("SYMBOL")
                            .long("hide-symbol")
                            .help("HideSymbol, 隐藏符号"),
                        Arg::new("hide_layer")
                            .value_name("LAYER")
                            .long("hide-layer")
                            .help("Hide, 隐藏图层")
                            .visible_alias("hide"),
                        Arg::new("mult_color")
                            .value_name("COLOR")
                            .long("mult-color")
                            .aliases(["mult-colour", "multcolour"])
                            .help("SetMultColour, 颜色乘法"),
                        Arg::new("add_color")
                            .value_name("COLOR")
                            .long("add-color")
                            .aliases(["add-colour", "addcolour"])
                            .help("SetAddColour, 颜色加法"),
                        Arg::new("symbol_mult_color")
                            .value_names(["SYMBOL", "COLOR"])
                            .long("symbol-mult-color")
                            .aliases(["symbol-mult-colour", "symbolmultcolour"])
                            .help("SetSymbolMultColour, 符号颜色乘法"),
                        Arg::new("symbol_add_color")
                            .value_names(["SYMBOL", "COLOR"])
                            .long("symbol-add-color")
                            .aliases(["symbol-add-colour", "symboladdcolour"])
                            .help("SymbolAddColour, 符号颜色加法"),
                        Arg::new("background_color")
                            .value_name("COLOR")
                            .long("background-color")
                            .visible_alias("bgc")
                            .help("背景色"),
                        Arg::new("fps")
                            .value_name("FPS")
                            .long("fps")
                            .short('r')
                            .help("动图/视频的每秒帧数"),
                        Arg::new("format")
                            .long("format")
                            .value_name("FORMAT")
                            .value_parser(["gif", "mp4", "mov", "png"])
                            .ignore_case(true)
                            .help("导出格式")
                    ])
                    .args(index_args.clone())
                    
                    .after_help("颜色参数:\n  css格式的颜色值, 例如: red, #f00, rgb(255,255,0), rgba(255,255,0,100), transparent")
                )
                .subcommand(clap::Command::new("install-ffmpeg")
                    .about("安装FFmpeg（视频编码模块）")
                    .visible_aliases(["ffmpeg"])
                    .args([
                        generic_args[0].clone(),
                        Arg::new("uninstall")
                            .long("uninstall")
                            .short('u')
                            .action(ArgAction::SetTrue)
                            .help("卸载已安装的FFmpeg"),
                        Arg::new("path")
                            .long("path")
                            .value_name("PATH")
                            .help("使用自定义安装, 需要有效的可执行文件路径, 例如: ffmpeg, path/to/ffmpeg.exe, /usr/local/bin/ffmpeg")
                            .conflicts_with("uninstall"),
                ]))
                .after_help("")
                .get_matches();

            Args { inner: matches, exec: std::env::args().next().unwrap_or("".into()) }
        }
    }

    impl UserData for Args {
        fn add_methods<'lua, T: rlua::UserDataMethods<'lua, Self>>(_methods: &mut T) {
            _methods.add_method("list", |lua, args, key: String|{
                match args.inner.subcommand_matches(
                    args.inner.subcommand_name().unwrap()
                ).unwrap().try_get_many::<String>(key.as_str()) {
                    Ok(v)=> match v {
                        Some(list)=> Ok(lua.create_table_from(list
                            .enumerate()
                            .map(|(i, s)|(i + 1, s.to_owned())))), // lua table index starts at 1
                        None=> Ok(lua.create_table()),
                    },
                    Err(_)=> Err(LuaError::RuntimeError(format!("Invalid arg name: {}", key))),
                }
            });
            _methods.add_meta_method(MetaMethod::Index, |lua, args, value: Value|{
                match value {
                    Value::String(s)=> {
                        let s = s.to_str().unwrap();
                        if s == "subcommand" {
                            convert_to_luastring(lua, args.inner.subcommand_name())
                        }
                        else {
                            // main arg matches
                            if let Ok(v) = args.inner.try_get_one::<String>(s) {
                                if let Some(v) = v {
                                    return convert_to_luastring(lua, Some(v.as_str()));
                                }
                                // continue trying to get subcommand if this value is None
                            }
                            // subcommand arg matches
                            let matches = args.inner.subcommand_matches(
                                args.inner.subcommand_name().unwrap()
                            ).unwrap();

                            if let Ok(v) = matches.try_get_one::<String>(s) {
                                convert_to_luastring(lua, v.map(|s|s.as_str()))
                            }
                            else if let Ok(v) = matches.try_get_one::<bool>(s) {
                                Ok(Value::Boolean(v == Some(&true)))
                            }
                            else {
                                Err(LuaError::RuntimeError(format!("Invalid arg: {}", s)))
                            }
                        }
                    },
                    Value::Number(n) if n == 0.0 => {
                        convert_to_luastring(lua, Some(args.exec.as_str()))
                    },
                    _ => Err(LuaError::ToLuaConversionError { from: "(lua)", to: "string", message: None })
                }
            });
            _methods.add_meta_method(MetaMethod::ToString, |_, args, ()|{
                Ok(format!("{:?}", args.inner))
            });
        }
    }

    pub fn init(lua_ctx: Context) -> LuaResult<()> {
        let globals = lua_ctx.globals();
        let args = Args::new();
        if args.inner.subcommand_name().is_some() {
            globals.set("Args", Args::new())?;
        }
        else {
            // avoid panic from strict.lua
            globals.set("Args", Value::Boolean(false))?;
        }
        Ok(())
    }
}