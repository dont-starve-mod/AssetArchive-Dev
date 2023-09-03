use clap::arg;
use clap::Arg;
use rlua::{UserData, Value, MetaMethod, Context};
use rlua::prelude::{LuaError, LuaResult};

pub mod lua_args {

    use super::*;
    struct Args {
        inner: clap::ArgMatches,
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
            let matches = clap::Command::new("Asset Archive CLI")
                .author("老王天天写bug")
                .version("0.0")
                .about("饥荒资源档案 - 命令行工具")
                .subcommand(clap::Command::new("dummy")
                    .about("快速测试路径参数")
                    .visible_aliases(["d"])
                    .args(generic_args.clone()))
                .subcommand(clap::Command::new("compile")
                    .about("编译词条信息")
                    .visible_aliases(["c"])
                    .args(generic_args.clone()))
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
                            .help("颜色乘法"),
                        Arg::new("add_color")
                            .value_name("COLOR")
                            .long("add-color")
                            .help("颜色加法"),
                        Arg::new("background_color")
                            .value_name("COLOR")
                            .long("background-color")
                            .visible_alias("bgc")
                            .help("设置背景颜色"),
                        Arg::new("fps")
                            .value_name("FPS")
                            .long("fps")
                            .short('r')
                            .help("设置动图或视频的帧速率"),
                        Arg::new("format")
                            .long("format")
                            .value_name("FORMAT")
                            .value_parser(["gif", "mp4", "mov", "png"])
                            .ignore_case(true)
                            .help("导出格式")
                    ])
                    .after_help("颜色参数:\n  css格式的颜色值, 例如: red, #f00, rgb(255,255,0), rgba(255,255,0,100), transparent")
                )
                .after_help("")
                .get_matches();

            Args { inner: matches }
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
            _methods.add_meta_method(MetaMethod::Index, |_, args, value: Value|{
                match value {
                    Value::String(s)=> {
                        let s = s.to_str().unwrap();
                        if s == "subcommand" {
                            Ok(args.inner.subcommand_name().map(|s|s.to_string()))
                        }
                        else {
                            // main arg
                            if let Ok(v) = args.inner.try_get_one::<String>(s) {
                                return Ok(v.map(|s|s.to_owned()));
                            }
                            // subcommand arg
                            match args.inner.subcommand_matches(
                                args.inner.subcommand_name().unwrap()
                            ).unwrap().try_get_one::<String>(s) {
                                Ok(v) => Ok(v.map(|s|s.to_owned())),
                                Err(_)=> Err(LuaError::RuntimeError(format!("Invalid arg name: {}", s))),
                            }
                        }
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
            globals.set("Args", Value::Boolean(false))?;
        }
        Ok(())
    }
}