use std::env;
use std::io::Read;
use std::process;
use std::path::PathBuf;
use std::path::Path;
use std::io::{stdin, stdout, stderr};
use std::ffi::{CString, CStr, c_char, c_uint, c_int, OsString};
use std::ptr::null_mut;
use std::time::Duration;
use std::error::Error;

mod fmod;
use ::fmod::FmodResultTrait;

static mut LAST_TIME: f64 = -1.0;

fn print_time() {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs_f64();
    if unsafe { LAST_TIME } > 0.0 {
        println!("[TIME] {:.2} (passed {:.2})", now, now - unsafe { LAST_TIME });
    }
    else {
        println!("[TIME] {:.2} (init)", now);
    }
    unsafe { LAST_TIME = now }
}

#[derive(Debug)]
pub struct FmodParam {
    name: String,
    range: (f32, f32),
    seekspeed: f32,
}

#[derive(Debug)]
pub struct FmodEventInfo {
    name: String,
    group: String,
    project: String,
    category: String,
    lengthms: i32,
    param_list: Vec<FmodParam>,
}

impl FmodEventInfo {
    pub fn get_path(&self) -> String {
        format!("{}/{}/{}", self.project, self.group, self.name)
    }

}

#[derive(Debug)]
pub struct FmodCore {
    system: *mut fmod::FMOD_EVENTSYSTEM,
    projects: Vec<*mut fmod::FMOD_EVENTPROJECT>,
}

fn convert_mem_to_string(mem: *const i8) -> String {
    unsafe { CStr::from_ptr(mem) }
        .to_string_lossy()
        .to_string()
}

impl FmodCore {
    fn new() -> Result<Self, String> {
        unsafe {
            println!("[FMOD] create event system");
            let mut system = null_mut();
            fmod::FMOD_EventSystem_Create(&mut system).as_result()?;
            println!("[FMOD] init event system");
            fmod::FMOD_EventSystem_Init(system, 64, 0, null_mut(), 0).as_result()?;
            if system.is_null() {
                Err("[FMOD] failed to construct FmodCore: system ptr is null".into())
            }
            else {
                Ok(FmodCore {
                    system,
                    projects: Vec::<_>::new(),
                })
            }
        }
    }

    fn load_dir(&mut self, dir: String) -> Result<(), String> {
        let dir_c = CString::new(dir.clone()).unwrap();
        unsafe {
            println!("[FMOD] set media path: {}", &dir);
            fmod::FMOD_EventSystem_SetMediaPath(self.system, dir_c.as_ptr()).as_result()?;
            println!("[FMOD] load all sounds in directory");
        };

        let dir = match std::fs::read_dir(dir) {
            Ok(dir)=> dir,
            Err(e)=> return Err(format!("[FMOD] failed to access directory: {}", e.to_string())),
        };

        for entry in dir {
            if entry.is_ok() {
                let path = entry.unwrap().path();
                if path.is_file() && path.extension() == Some(&OsString::from("fev")) {
                    let name = path.file_name().unwrap();
                    print!("[FMOD] 🎵 - {:?} ", name);
                    let path_c = CString::new(name.to_str().unwrap_or("")).unwrap();
                    let loadinfo = null_mut();
                    let mut project = null_mut();
                    unsafe {
                        match fmod::FMOD_EventSystem_Load(
                            self.system, path_c.as_ptr(), 
                            loadinfo, 
                            &mut project
                        ).as_result() {
                            Ok(_)=> println!("(OK)"),
                            Err(e)=> println!("({})", e)
                        }
                    }
                    self.projects.push(project);
                }
            }
        }

        Ok(())
    }

    /// list all sound events in this fmod system
    fn list(&self) -> Result<(), String> {
        print_time();
        for project in &self.projects {
            let mut num = 0;
            unsafe {    
                fmod::FMOD_EventProject_GetNumEvents(*project, &mut num);
            };
            if num > 0 {
                for i in 0..num {
                    let mut event: *mut fmod::FMOD_EVENT = null_mut();
                    unsafe { 
                        fmod::FMOD_EventProject_GetEventByProjectID(*project, i as u32, 4, &mut event).as_result()?; // todo
                    };
                    if !event.is_null() {
                        match self.get_event_info(event) {
                            Ok(info)=> println!("{:?}", info),
                            Err(e)=> println!("[FMOD] Error in get_event_info(): {}", e)
                        }
                    }
                }
            }
        }
        print_time();
        Ok(())
    }

    /// get information of a fmod event, fast
    fn get_event_info(&self, event: *mut fmod::FMOD_EVENT) -> Result<FmodEventInfo, String> {
        // name
        let mut name = null_mut();
        let mut info = fmod::FMOD_EVENT_INFO::default();
        unsafe {
            fmod::FMOD_Event_GetInfo(event, std::ptr::null_mut(), &mut name, &mut info).as_result()?;
        }
        // category
        let mut category = null_mut();
        let mut category_name = null_mut();
        let mut category_name_list = Vec::<String>::new();
        unsafe {
            fmod::FMOD_Event_GetCategory(event, &mut category).as_result()?;
        }
        let category_path = loop {
            unsafe {
                fmod::FMOD_EventCategory_GetInfo(category, null_mut(), &mut category_name).as_result()?;
            }
            category_name_list.push(convert_mem_to_string(category_name));
            let mut parent = null_mut();
            unsafe {
                fmod::FMOD_EventCategory_GetParentCategory(category, &mut parent).as_result()?;
            }
            if parent.is_null() {
                category_name_list.reverse();
                break category_name_list.join("/")
            }
            else {
                category = parent;
            }
        };
        // group
        let mut group = null_mut();
        unsafe {
            fmod::FMOD_Event_GetParentGroup(event, &mut group).as_result()?;
        }
        let mut group_name = null_mut();
        let mut group_name_list = Vec::<String>::new();
        let group_path = loop {
            unsafe {
                fmod::FMOD_EventGroup_GetInfo(group, null_mut(), &mut group_name).as_result()?;
            }
            group_name_list.push(convert_mem_to_string(group_name));
            let mut parent = null_mut();
            unsafe {
                fmod::FMOD_EventGroup_GetParentGroup(group, &mut parent).as_result()?;
            }
            if parent.is_null() {
                group_name_list.reverse();
                break group_name_list.join("/")
            }
            else {
                group = parent;
            }
        };
        // project
        let mut project = null_mut();
        unsafe {
            fmod::FMOD_EventGroup_GetParentProject(group, &mut project).as_result()?;
        }
        let mut project_info = fmod::FMOD_EVENT_PROJECTINFO::default();
        unsafe {
            fmod::FMOD_EventProject_GetInfo(project, &mut project_info).as_result()?;
        }
        // parameter
        let mut num_params = 0;
        unsafe {
            fmod::FMOD_Event_GetNumParameters(event, &mut num_params).as_result()?;
        }
        let mut param_list = Vec::<_>::new();
        for i in 0..num_params {
            let mut param = null_mut();
            let mut param_name = null_mut();
            unsafe {
                fmod::FMOD_Event_GetParameterByIndex(event, i as i32, &mut param).as_result()?;
                fmod::FMOD_EventParameter_GetInfo(param, null_mut(), &mut param_name).as_result()?;
            }  
            if !param_name.is_null() {
                let (mut min, mut max, mut seekspeed) = (0.0, 0.0, 0.0);
                unsafe {
                    fmod::FMOD_EventParameter_GetRange(param, &mut min, &mut max).as_result()?;
                    fmod::FMOD_EventParameter_GetSeekSpeed(param, &mut seekspeed).as_result()?;
                }
                param_list.push(FmodParam{
                    name: convert_mem_to_string(param_name),
                    range: (min, max),
                    seekspeed
                });
            }
        }
        Ok(FmodEventInfo{
            name: convert_mem_to_string(name),
            group: group_path,
            category: category_path,
            project: convert_mem_to_string(project_info.name.as_ptr()),
            lengthms: info.lengthms,
            param_list,
        })
    }

    fn unload(&mut self) -> Result<(), String> {
        println!("[FMOD] unload all files");
        self.projects.clear();
        unsafe {
            fmod::FMOD_EventSystem_Unload(self.system).as_result()
        }
    }

    fn run(&mut self) -> Result<(), String> {
        loop {
            let mut buf = String::new();
            println!(">>>>>");
            for line in stdin().lines() {
                println!("$ {}", line.unwrap());
            }
            if stdin().read_line(&mut buf).is_err() {
                println!("Error");
                std::process::exit(1);
            }
            if buf.len() > 0 {
                println!("输入: {}", buf);
            }
            
            std::thread::sleep(Duration::from_millis(16));
        }
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut core = match FmodCore::new() {
        Ok(v)=> v,
        Err(e)=> {
            println!("[FMOD] Fatal error, exit: {}", e);
            process::exit(8); // FATAL
        }
    };

    core.load_dir("/Users/wzh/Library/Application Support/Steam/steamapps/common/Don't Starve Together/dontstarve_steam.app/Contents/mods/homura-12.8/sound/".into())?;
    core.load_dir("/Users/wzh/DST/dontstarve_dedicated_server_nullrenderer.app/Contents/data/sound/".into())?;
    core.list()?;
    //     let mut event = std::ptr::null_mut();
    //     check_result(fmod::FMOD_EventSystem_GetEvent(system,
    //         CString::new("lw_homura/rpg/atk_3d").unwrap().into_raw(),
    //         0,
    //         &mut event,
    //     ));

    //     println!("加载音效成功! {:?}", event);
    //     let mut state: c_uint = 0;
    //     fmod::FMOD_Event_Start(event);
    //     loop {
    //         fmod::FMOD_EventSystem_Update(system);
    //         fmod::FMOD_Event_GetState(event, &mut state);
    //         sleep(Duration::from_millis(16));

    //         if state & fmod::FMOD_EVENT_STATE_PLAYING > 0 {
    //             // is playing...
    //         }
    //         else {
    //             // break;
    //         }
    //     }
    // }

    core.run()?;

    Ok(())
}
