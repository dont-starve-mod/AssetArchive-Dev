use std::env;
use std::process;
use std::path::Path;
use std::ffi::{CString, c_char, c_uint};
use std::thread::sleep;
use std::time::Duration;
use std::error::Error;

use shared_memory::{ShmemConf, Shmem};

mod fmod;

const EXIT_CODE_FAILED_TO_INIT: i32 = 1; // 程序初始化失败, 提供一个警告信息, 不应执行重试

const MEM_LEN: usize = 16384;
const MEM_WRITE_OFFSET: usize = 8196;

/// 将fmod api的错误码转换为字符串格式
pub fn format_fmod_result(result: fmod::FMOD_RESULT)-> String {
    match result {  
        0 => "FMOD_RESULT_FMOD_OK", 
        1 => "FMOD_RESULT_FMOD_ERR_ALREADYLOCKED",
        2 => "FMOD_RESULT_FMOD_ERR_BADCOMMAND",
        3 => "FMOD_RESULT_FMOD_ERR_CDDA_DRIVERS",
        4 => "FMOD_RESULT_FMOD_ERR_CDDA_INIT",
        5 => "FMOD_RESULT_FMOD_ERR_CDDA_INVALID_DEVICE",
        6 => "FMOD_RESULT_FMOD_ERR_CDDA_NOAUDIO",
        7 => "FMOD_RESULT_FMOD_ERR_CDDA_NODEVICES",
        8 => "FMOD_RESULT_FMOD_ERR_CDDA_NODISC",
        9 => "FMOD_RESULT_FMOD_ERR_CDDA_READ",
        10 => "FMOD_RESULT_FMOD_ERR_CHANNEL_ALLOC",
        11 => "FMOD_RESULT_FMOD_ERR_CHANNEL_STOLEN",
        12 => "FMOD_RESULT_FMOD_ERR_COM",
        13 => "FMOD_RESULT_FMOD_ERR_DMA",
        14 => "FMOD_RESULT_FMOD_ERR_DSP_CONNECTION",
        15 => "FMOD_RESULT_FMOD_ERR_DSP_FORMAT",
        16 => "FMOD_RESULT_FMOD_ERR_DSP_NOTFOUND",
        17 => "FMOD_RESULT_FMOD_ERR_DSP_RUNNING",
        18 => "FMOD_RESULT_FMOD_ERR_DSP_TOOMANYCONNECTIONS",
        19 => "FMOD_RESULT_FMOD_ERR_FILE_BAD",
        20 => "FMOD_RESULT_FMOD_ERR_FILE_COULDNOTSEEK",
        21 => "FMOD_RESULT_FMOD_ERR_FILE_DISKEJECTED",
        22 => "FMOD_RESULT_FMOD_ERR_FILE_EOF",
        23 => "FMOD_RESULT_FMOD_ERR_FILE_NOTFOUND",
        24 => "FMOD_RESULT_FMOD_ERR_FILE_UNWANTED",
        25 => "FMOD_RESULT_FMOD_ERR_FORMAT",
        26 => "FMOD_RESULT_FMOD_ERR_HTTP",
        27 => "FMOD_RESULT_FMOD_ERR_HTTP_ACCESS",
        28 => "FMOD_RESULT_FMOD_ERR_HTTP_PROXY_AUTH",
        29 => "FMOD_RESULT_FMOD_ERR_HTTP_SERVER_ERROR",
        30 => "FMOD_RESULT_FMOD_ERR_HTTP_TIMEOUT",
        31 => "FMOD_RESULT_FMOD_ERR_INITIALIZATION",
        32 => "FMOD_RESULT_FMOD_ERR_INITIALIZED",
        33 => "FMOD_RESULT_FMOD_ERR_INTERNAL",
        34 => "FMOD_RESULT_FMOD_ERR_INVALID_ADDRESS",
        35 => "FMOD_RESULT_FMOD_ERR_INVALID_FLOAT",
        36 => "FMOD_RESULT_FMOD_ERR_INVALID_HANDLE",
        37 => "FMOD_RESULT_FMOD_ERR_INVALID_PARAM",
        38 => "FMOD_RESULT_FMOD_ERR_INVALID_POSITION",
        39 => "FMOD_RESULT_FMOD_ERR_INVALID_SPEAKER",
        40 => "FMOD_RESULT_FMOD_ERR_INVALID_SYNCPOINT",
        41 => "FMOD_RESULT_FMOD_ERR_INVALID_VECTOR",
        42 => "FMOD_RESULT_FMOD_ERR_MAXAUDIBLE",
        43 => "FMOD_RESULT_FMOD_ERR_MEMORY",
        44 => "FMOD_RESULT_FMOD_ERR_MEMORY_CANTPOINT",
        45 => "FMOD_RESULT_FMOD_ERR_MEMORY_SRAM",
        46 => "FMOD_RESULT_FMOD_ERR_NEEDS2D",
        47 => "FMOD_RESULT_FMOD_ERR_NEEDS3D",
        48 => "FMOD_RESULT_FMOD_ERR_NEEDSHARDWARE",
        49 => "FMOD_RESULT_FMOD_ERR_NEEDSSOFTWARE",
        50 => "FMOD_RESULT_FMOD_ERR_NET_CONNECT",
        51 => "FMOD_RESULT_FMOD_ERR_NET_SOCKET_ERROR",
        52 => "FMOD_RESULT_FMOD_ERR_NET_URL",
        53 => "FMOD_RESULT_FMOD_ERR_NET_WOULD_BLOCK",
        54 => "FMOD_RESULT_FMOD_ERR_NOTREADY",
        55 => "FMOD_RESULT_FMOD_ERR_OUTPUT_ALLOCATED",
        56 => "FMOD_RESULT_FMOD_ERR_OUTPUT_CREATEBUFFER",
        57 => "FMOD_RESULT_FMOD_ERR_OUTPUT_DRIVERCALL",
        58 => "FMOD_RESULT_FMOD_ERR_OUTPUT_ENUMERATION",
        59 => "FMOD_RESULT_FMOD_ERR_OUTPUT_FORMAT",
        60 => "FMOD_RESULT_FMOD_ERR_OUTPUT_INIT",
        61 => "FMOD_RESULT_FMOD_ERR_OUTPUT_NOHARDWARE",
        62 => "FMOD_RESULT_FMOD_ERR_OUTPUT_NOSOFTWARE",
        63 => "FMOD_RESULT_FMOD_ERR_PAN",
        64 => "FMOD_RESULT_FMOD_ERR_PLUGIN",
        65 => "FMOD_RESULT_FMOD_ERR_PLUGIN_INSTANCES",
        66 => "FMOD_RESULT_FMOD_ERR_PLUGIN_MISSING",
        67 => "FMOD_RESULT_FMOD_ERR_PLUGIN_RESOURCE",
        68 => "FMOD_RESULT_FMOD_ERR_PRELOADED",
        69 => "FMOD_RESULT_FMOD_ERR_PROGRAMMERSOUND",
        70 => "FMOD_RESULT_FMOD_ERR_RECORD",
        71 => "FMOD_RESULT_FMOD_ERR_REVERB_INSTANCE",
        72 => "FMOD_RESULT_FMOD_ERR_SUBSOUND_ALLOCATED",
        73 => "FMOD_RESULT_FMOD_ERR_SUBSOUND_CANTMOVE",
        74 => "FMOD_RESULT_FMOD_ERR_SUBSOUND_MODE",
        75 => "FMOD_RESULT_FMOD_ERR_SUBSOUNDS",
        76 => "FMOD_RESULT_FMOD_ERR_TAGNOTFOUND",
        77 => "FMOD_RESULT_FMOD_ERR_TOOMANYCHANNELS",
        78 => "FMOD_RESULT_FMOD_ERR_UNIMPLEMENTED",
        79 => "FMOD_RESULT_FMOD_ERR_UNINITIALIZED",
        80 => "FMOD_RESULT_FMOD_ERR_UNSUPPORTED",
        81 => "FMOD_RESULT_FMOD_ERR_UPDATE",
        82 => "FMOD_RESULT_FMOD_ERR_VERSION",
        83 => "FMOD_RESULT_FMOD_ERR_EVENT_FAILED",
        84 => "FMOD_RESULT_FMOD_ERR_EVENT_INFOONLY",
        85 => "FMOD_RESULT_FMOD_ERR_EVENT_INTERNAL",
        86 => "FMOD_RESULT_FMOD_ERR_EVENT_MAXSTREAMS",
        87 => "FMOD_RESULT_FMOD_ERR_EVENT_MISMATCH",
        88 => "FMOD_RESULT_FMOD_ERR_EVENT_NAMECONFLICT",
        89 => "FMOD_RESULT_FMOD_ERR_EVENT_NOTFOUND",
        90 => "FMOD_RESULT_FMOD_ERR_EVENT_NEEDSSIMPLE",
        91 => "FMOD_RESULT_FMOD_ERR_EVENT_GUIDCONFLICT",
        92 => "FMOD_RESULT_FMOD_ERR_EVENT_ALREADY_LOADED",
        93 => "FMOD_RESULT_FMOD_ERR_MUSIC_UNINITIALIZED",
        94 => "FMOD_RESULT_FMOD_ERR_MUSIC_NOTFOUND",
        95 => "FMOD_RESULT_FMOD_ERR_MUSIC_NOCALLBACK",
        _ => return format!("FMOD_RESULT_FMOD_ERR__UNKNOWN:{}", result), // 这里是String类型, 直接手动返回
    }.to_string()
}

#[test]
fn match_error_code(){
    assert_eq!(format_fmod_result(fmod::FMOD_RESULT_FMOD_ERR_COM), "FMOD_RESULT_FMOD_ERR_COM".to_string());
    assert_eq!(format_fmod_result(fmod::FMOD_RESULT_FMOD_OK), "FMOD_RESULT_FMOD_OK".to_string());
    assert_eq!(format_fmod_result(100), "FMOD_RESULT_FMOD_ERR__UNKNOWN:100".to_string());
}

fn check_result(result: fmod::FMOD_RESULT)-> Result<(), (fmod::FMOD_RESULT, String)> {
    match result {
        0=> Ok(()),
        n=> Err((n, format_fmod_result(n))),
    }
}

pub struct MessageHandler{
    mem_name: String,       // 共享内存的名字 (标识符)
    mem: Shmem,             // 共享内存实例
}

impl MessageHandler { 
    fn new(mut args: env::Args) -> Result<Self, String> {
        args.next(); // skip first
        let mem_name = match args.next() {
            Some(name) => name,
            None => return Err("缺少参数: mem_name".to_string()),
        };
        let mut mem: Shmem = match ShmemConf::new().os_id(&mem_name).open() {
            Ok(m) => m,
            Err(err) => return Err(format!("共享内存链接失败: {}", err))
        };

        if mem.len() < MEM_LEN {
            return Err(format!("共享内存长度错误: 期望{}, 得到{}", MEM_LEN, mem.len()));
        }

        Ok(Self {
            mem_name,
            mem,
        })
            
    }

    fn get_u16(&mut self, offset: usize) -> u16 {
        let buf = unsafe{ self.mem.as_slice_mut() };
        buf[offset] as u16 + buf[offset+1] as u16* 256
    }

    fn set_u16(&mut self, num: u16, offset: usize) {
        let mut buf = unsafe{ self.mem.as_slice_mut() };
        let bytes = num.to_le_bytes();
        buf[MEM_WRITE_OFFSET+offset]   = bytes[0];
        buf[MEM_WRITE_OFFSET+offset+1] = bytes[1];
    }

    fn get_commands(&mut self) {
        let buf = unsafe{ self.mem.as_slice_mut() };
        let code: u16 = buf[0] as u16 + buf[1] as u16* 256;
        if code == 65533 { // ID_KILL_CHILD
            println!("结束信号: {}", code);
            process::exit(0);
        }
        else if code == 0 || code == 65535 || code == 65534 {
            return;
        }
        return;
    }

    fn update(&mut self) {

    }

}

#[derive(Debug)]
pub struct FmodCore {

}

fn main() {
    let mut handler = MessageHandler::new(env::args()).unwrap_or_else(|err| {
        eprintln!("fmodcore初始化失败: {}", err);
        process::exit(EXIT_CODE_FAILED_TO_INIT);
    });

    dbg!(handler.get_u16(0));

    handler.set_u16(255,0);

    loop {
        handler.update();
        sleep(Duration::from_millis(25)); // 40fps
    }
    return;

    let file = String::from("/Users/wzh/Library/Application Support/Steam/steamapps/common/Don't Starve Together/dontstarve_steam.app/Contents/mods/homura-12.8/sound/");
    let temp = CString::new(file).unwrap(); // 不安全 注意
    let file_c_str: *const c_char = temp.as_ptr();

    unsafe {    
        let mut system = std::ptr::null_mut();
        check_result(fmod::FMOD_EventSystem_Create(&mut system));
        check_result(fmod::FMOD_EventSystem_Init(system, 64, 0, std::ptr::null_mut(), 0));
        check_result(fmod::FMOD_EventSystem_SetMediaPath(system, file_c_str));
        println!("切换工作目录成功!");

        check_result(fmod::FMOD_EventSystem_Load(system,
            CString::new("lw_homura.fev").unwrap().into_raw(), 
            std::ptr::null_mut(), 
            std::ptr::null_mut())
        );
        println!("加载项目成功!");

        let mut event = std::ptr::null_mut();
        check_result(fmod::FMOD_EventSystem_GetEvent(system,
            CString::new("lw_homura/rpg/atk_3d").unwrap().into_raw(),
            0,
            &mut event,
        ));

        println!("加载音效成功! {:?}", event);
        let mut state: c_uint = 0;
        fmod::FMOD_Event_Start(event);
        loop {
            fmod::FMOD_EventSystem_Update(system);
            fmod::FMOD_Event_GetState(event, &mut state);
            sleep(Duration::from_millis(16));

            if state & fmod::FMOD_EVENT_STATE_PLAYING > 0 {
                // is playing...
            }
            else {
                // break;
            }
        }
    }

    println!("Hello, world!");
}
