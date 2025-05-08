use std::process::{Command, Stdio, Child};
use std::path::{PathBuf, Path};
use std::io::{Write, Read, BufRead, BufReader};
use std::collections::HashMap;
use std::fs::File;
use json::JsonValue;

trait ReadExt: Read {
    /// find next string in file (TODO: check performance)
    fn seek_to_string(&mut self, neddle: &str) -> Result<(), String> {
        let bytes = neddle.as_bytes();
        let mut index = 0;
        let max_index = bytes.len();
        let mut buf: [u8; 1] = [0];
        loop {
            match self.read(&mut buf) {
                Ok(0) => return Err(format!("Failed to seek to string: {}", neddle)),
                Ok(_) => {
                    if buf[0] == bytes[index] {
                        index += 1;
                        if index == max_index {
                            return Ok(());
                        }
                    }
                    else{
                        index = 0;
                    }
                },
                Err(e) => return Err(format!("Failed to read file while seeking to string: {}, {}", neddle, e)),
            }
        }
    }

    fn read_l_buf(&mut self) -> Result<Vec<u8>, String> {
        let mut buf = [0; 4];
        self.read_exact(&mut buf).map_err(|e| format!("Failed to read file: {}", e))?;
        let len = u32::from_le_bytes(buf);
        let mut buf = vec![0; len as usize];
        self.read_exact(&mut buf).map_err(|e| format!("Failed to read file: {}", e))?;
        // remove last \0
        let buf = buf.strip_suffix(&[0]).unwrap_or(&buf).to_vec();
        Ok(buf)
    }
}

impl ReadExt for File {}

#[derive(Debug, Default)]
pub struct FmodEvent {
    pub is_simple: bool,
    pub path_index: Vec<u32>,
    pub path: Vec<String>,
    pub has_sounddef: bool,
    pub sounddef_index_list: Vec<u32>,
    pub ref_file_list: Vec<FmodSoundDefFile>,
}

impl FmodEvent {
    pub fn resolve_path(&mut self, string_table: &[String]) {
        self.path.clear();
        for i in 0..self.path_index.len() {
            let index = self.path_index[i] as usize;
            if index >= string_table.len() {
                log::error!("Invalid path index: {}", index);
                self.path.push("[INVALID]".to_string());
            }
            else {                
                self.path.push(string_table[index].clone());
            }
        }
    }

    pub fn resolve_def(&mut self, sounddef_list: &[FmodSoundDef]) {
        self.ref_file_list.clear();
        for index in self.sounddef_index_list.iter() {
            if let Some(sounddef) = sounddef_list.get(*index as usize) {
                for file in &sounddef.file_list {
                    self.ref_file_list.push(file.clone());
                }
            }
            else {
                log::error!("Invalid sounddef index: {}", index);
            }
        }
    }

    pub fn to_json(&self) -> JsonValue {
        json::object!{
            "is_simple": self.is_simple,
            "path": self.path.join("/"),
            "sounddef_index_list": self.sounddef_index_list.clone(),
        }
    }
}

#[derive(Debug, Default)]
pub struct FmodSoundDef {
    pub name_index: u32,
    pub name: String,
    pub file_list: Vec<FmodSoundDefFile>,
}

impl FmodSoundDef {
    pub fn resolve_path(&mut self, string_table: &[String]) {
        let index = self.name_index as usize;
        if index >= string_table.len() {
            log::error!("Invalid sounddef name index: {}", index);
            self.name = "[INVALID]".to_string();
        }
        else {                
            self.name = string_table[index].clone();
        }
    }

    pub fn to_json(&self) -> JsonValue {
        json::object!{
            "file_list": self.file_list.iter().map(|v| v.to_json()).collect::<Vec<JsonValue>>(),
        }
    }
}

#[derive(Debug, Default, Clone)]
pub struct FmodSoundDefFile {
    pub path: String,
    pub bank_name: String,
    pub file_index: u32,
    pub lengthms: u32,
}

impl FmodSoundDefFile {
    pub fn to_json(&self) -> JsonValue {
        json::object!{
            "path": self.path.clone(),
            "bank_name": self.bank_name.clone(),
            "file_index": self.file_index,
            "lengthms": self.lengthms,
        }
    }
}

/// *.fev file parse info
#[derive(Debug, Default)]
struct FmodFev {
    pub proj_name: String,
    pub bank_list: Vec<String>,
    pub event_map: HashMap<String, FmodEvent>,
    // pub numbanks: u32,
    // pub numcategories: u32,
    // pub numgroups: u32,
}

impl FmodFev {
    pub fn parse(mut f: impl ReadExt) -> Result<FmodFev, String> {
        #[allow(non_snake_case)]
        let EOF = |_| {format!("Unexpected EOF")};
        f.seek_to_string("RIFF")?;
        f.seek_to_string("LIST")?;
        f.seek_to_string("PROJ")?;
        f.seek_to_string("OBCT")?;
        let mut buf = [0; 128];
        let mut int_buf = [0; 4];
        let mut short_buf = [0; 2];
        f.read_exact(&mut buf[0..20]).map_err(EOF)?;
        f.read_exact(&mut int_buf).map_err(EOF)?;
        let numbanks = u32::from_le_bytes(int_buf);
        f.read_exact(&mut buf[0..4]).map_err(EOF)?;
        f.read_exact(&mut int_buf).map_err(EOF)?;
        let numcategories = u32::from_le_bytes(int_buf);
        f.read_exact(&mut buf[0..4]).map_err(EOF)?;
        f.read_exact(&mut int_buf).map_err(EOF)?;
        let numgroups = u32::from_le_bytes(int_buf);
        f.read_exact(&mut buf[0..36]).map_err(EOF)?;
        f.read_exact(&mut int_buf).map_err(EOF)?;
        let numevents = u32::from_le_bytes(int_buf);
        f.read_exact(&mut buf[0..28]).map_err(EOF)?;
        f.read_exact(&mut int_buf).map_err(EOF)?;
        let numreverbs = u32::from_le_bytes(int_buf);
        f.read_exact(&mut buf[0..4]).map_err(EOF)?;
        f.read_exact(&mut int_buf).map_err(EOF)?;
        let numwaveforms = u32::from_le_bytes(int_buf);
        f.read_exact(&mut buf[0..28]).map_err(EOF)?;
        f.read_exact(&mut int_buf).map_err(EOF)?;
        let numsounddefs = u32::from_le_bytes(int_buf);
        f.read_exact(&mut buf[0..128]).map_err(EOF)?;
        let name_buf = f.read_l_buf()?;
        let name = String::from_utf8_lossy(&name_buf).to_string();

        log::debug!(r#"Fev head data: 
    numbanks: {}
    numcategories: {}
    numgroups: {}
    numevents: {}
    numreverbs: {}
    numwaveforms: {}
    numsounddefs: {}
    name: {}"#, 
    numbanks,
    numcategories,
    numgroups,
    numevents,
    numreverbs,
    numwaveforms,
    numsounddefs,
    name);

        f.seek_to_string("LGCY")?;
        f.read_exact(&mut buf[0..12]).map_err(EOF)?;
        // NOTE: 这里又读了一遍projname
        let name_buf = f.read_l_buf()?;
        let proj_name = String::from_utf8_lossy(&name_buf).to_string();

        let mut bank_list = vec![];
        f.read_exact(&mut buf[0..8]).map_err(EOF)?;
        for _ in 0..numbanks {
            f.read_exact(&mut buf[0..20]).map_err(EOF)?;
            let name_buf = f.read_l_buf()?;
            let name = String::from_utf8_lossy(&name_buf).to_string();
            bank_list.push(name);
        }

        log::debug!("Fev bank list: {:?}", bank_list);

        let mut category_list = vec![];
        for _ in 0..numcategories {
            let name_buf = f.read_l_buf()?;
            let name = String::from_utf8_lossy(&name_buf).to_string();
            f.read_exact(&mut buf[0..20]).map_err(EOF)?;
            category_list.push(name);
        }

        log::debug!("Fev category list: {:?}", category_list);

        let mut item_index_stack = vec![];
        let mut event_list = vec![];

        let mut parse_event = |f: &mut dyn ReadExt, item_index_stack: &mut Vec<u32>| {
            let mut buf = [0; 256];
            let mut int_buf = [0; 4];
            f.read_exact(&mut int_buf).map_err(EOF)?;
            let type_num = u32::from_le_bytes(int_buf);
            match type_num {
                16=> {
                    log::debug!("Simple Event");
                    f.read_exact(&mut int_buf).map_err(EOF)?;
                    let name_index = u32::from_le_bytes(int_buf);
                    f.read_exact(&mut buf[0..16+144]).map_err(EOF)?;
                    f.read_exact(&mut int_buf).map_err(EOF)?;
                    let num = u32::from_le_bytes(int_buf);
                    if num > 1 {
                        return Err(format!("Simple event must have only 0/1 sounddef"));
                    }
                    f.read_exact(&mut int_buf).map_err(EOF)?;
                    let def_index = u32::from_le_bytes(int_buf);
                    f.read_exact(&mut buf[0..58]).map_err(EOF)?;
                    let category_buf = f.read_l_buf()?;
                    let mut path_index = item_index_stack.clone();
                    path_index.push(name_index);
                    event_list.push(FmodEvent {
                        is_simple: true,
                        path_index,
                        has_sounddef: num > 0,
                        sounddef_index_list: vec![def_index],
                        ..Default::default()
                    });
                },
                8=> {
                    log::debug!("Multi-track Event");
                    f.read_exact(&mut int_buf).map_err(EOF)?;
                    let name_index = u32::from_le_bytes(int_buf);
                    f.read_exact(&mut buf[0..16+144]).map_err(EOF)?;
                    f.read_exact(&mut int_buf).map_err(EOF)?;
                    let num_layers = u32::from_le_bytes(int_buf);
                    let mut refs = vec![];
                    for _ in 0..num_layers {
                        f.read_exact(&mut buf[0..6]).map_err(EOF)?;
                        f.read_exact(&mut int_buf).map_err(EOF)?;
                        let num_sounds = u16::from_le_bytes([int_buf[0], int_buf[1]]);
                        let num_envelopes = u16::from_le_bytes([int_buf[2], int_buf[3]]);
                        for _ in 0..num_sounds {
                            f.read_exact(&mut short_buf).map_err(EOF)?;
                            let index = u16::from_le_bytes(short_buf);
                            refs.push(index);
                            f.read_exact(&mut buf[0..56]).map_err(EOF)?;
                        }
                        for _ in 0..num_envelopes {
                            f.read_exact(&mut buf[0..4]).map_err(EOF)?;
                            f.read_exact(&mut int_buf).map_err(EOF)?;
                            let length = u32::from_le_bytes(int_buf);
                            if length > 0 {
                                f.read_exact(&mut buf[0..length as usize]).map_err(EOF)?;
                            }
                            f.read_exact(&mut buf[0..12]).map_err(EOF)?;
                            f.read_exact(&mut int_buf).map_err(EOF)?;
                            let num_points = u32::from_le_bytes(int_buf);
                            f.read_exact(&mut buf[0..4*num_points as usize]).map_err(EOF)?;
                            f.read_exact(&mut buf[0..8]).map_err(EOF)?;
                        }
                    }
                    f.read_exact(&mut int_buf).map_err(EOF)?;
                    let num_params = u32::from_le_bytes(int_buf);
                    f.read_exact(&mut buf[0..32*num_params as usize]).map_err(EOF)?;
                    f.read_exact(&mut buf[0..8]).map_err(EOF)?;
                    let category_buf = f.read_l_buf()?;
                    let mut path_index = item_index_stack.clone();
                    path_index.push(name_index);
                    event_list.push(FmodEvent{
                        is_simple: false,
                        path_index,
                        has_sounddef: !refs.is_empty(),
                        sounddef_index_list: refs.iter().map(|x| *x as u32).collect(),
                        ..Default::default()
                    });
                },
                n=> return Err(format!("Invalid event type: {}", n)),
            };
            Ok(())
        };

        enum State {
            ReadGroupHeader,
            ReadSubgroups(u32),
            ReadEvents(u32),
        }
        f.read_exact(&mut int_buf).map_err(EOF)?;
        let num_root_groups = u32::from_le_bytes(int_buf);

        let mut stack = vec![State::ReadSubgroups(num_root_groups)];
        while let Some(state) = stack.pop() {
            match state {
                State::ReadGroupHeader => {
                    f.read_exact(&mut int_buf).map_err(EOF)?;
                    let group_name_index = u32::from_le_bytes(int_buf);
                    f.read_exact(&mut buf[0..4]).map_err(EOF)?;
                    f.read_exact(&mut int_buf).map_err(EOF)?;
                    let numsubgroups = u32::from_le_bytes(int_buf);
                    f.read_exact(&mut int_buf).map_err(EOF)?;
                    let numevents = u32::from_le_bytes(int_buf);
                    
                    item_index_stack.push(group_name_index);
                    
                    stack.push(State::ReadEvents(numevents));
                    stack.push(State::ReadSubgroups(numsubgroups));
                }
                State::ReadSubgroups(mut remaining) => {
                    if remaining > 0 {
                        remaining -= 1;
                        stack.push(State::ReadSubgroups(remaining));
                        stack.push(State::ReadGroupHeader);
                    }
                }
                State::ReadEvents(numevents) => {
                    for _ in 0..numevents {
                        parse_event(&mut f, &mut item_index_stack)?;
                    }
                    item_index_stack.pop();
                }
            }
        };

        let mut sounddef_list = vec![];

        f.read_exact(&mut int_buf).map_err(EOF)?;
        let num = u32::from_le_bytes(int_buf);
        f.read_exact(&mut vec![0; 74 * num as usize]).map_err(EOF)?;
        f.read_exact(&mut int_buf).map_err(EOF)?;
        let numsounddefs = u32::from_le_bytes(int_buf);
        for _ in 0..numsounddefs {
            f.read_exact(&mut int_buf).map_err(EOF)?;
            let name_index = u32::from_le_bytes(int_buf);
            f.read_exact(&mut int_buf).map_err(EOF)?;
            let num = u32::from_le_bytes(int_buf);
            f.read_exact(&mut int_buf).map_err(EOF)?;
            let numwaveforms = u32::from_le_bytes(int_buf);
            let mut sounddef = FmodSoundDef{name_index, ..Default::default()};
            for _ in 0..numwaveforms {
                f.read_exact(&mut int_buf).map_err(EOF)?;
                let type_num = u32::from_le_bytes(int_buf);
                f.read_exact(&mut int_buf).map_err(EOF)?;
                let weight = u32::from_le_bytes(int_buf);
                match type_num {
                    0 => {
                        let path_buf = f.read_l_buf()?;
                        let path = String::from_utf8_lossy(&path_buf).to_string();
                        f.read_exact(&mut int_buf).map_err(EOF)?;
                        let bank_index = u32::from_le_bytes(int_buf);
                        let bank_name = bank_list.get(bank_index as usize)
                            .unwrap_or(&"[INVALID]".to_string())
                            .clone();
                        f.read_exact(&mut int_buf).map_err(EOF)?;
                        let file_index = u32::from_le_bytes(int_buf);
                        f.read_exact(&mut int_buf).map_err(EOF)?;
                        let lengthms = u32::from_le_bytes(int_buf);
                        sounddef.file_list.push(FmodSoundDefFile{
                            path, bank_name, file_index, lengthms
                        });
                    },
                    1 => {
                        f.read_exact(&mut buf[0..8]).map_err(EOF)?;
                    },
                    2 | 3 => {},
                    _ => return Err(format!("Invalid waveform type: {}", type_num)),
                }
            }
            sounddef_list.push(sounddef);
        };

        f.seek_to_string("EPRP")?;
        f.seek_to_string("STRR")?;
        f.read_exact(&mut int_buf).map_err(EOF)?;
        let len = u32::from_le_bytes(int_buf);
        f.read_exact(&mut int_buf).map_err(EOF)?;
        let numstrings = u32::from_le_bytes(int_buf);

        let mut offset_list = vec![];
        for _ in 0..numstrings {
            f.read_exact(&mut int_buf).map_err(EOF)?;
            offset_list.push(u32::from_le_bytes(int_buf));
        };
        let mut content_buf = vec![0; (len- 4-4*numstrings) as usize];
        f.read_exact(&mut content_buf).map_err(EOF)?;
        let mut string_table = vec![];
        for i in 0..offset_list.len()-1 {
            let s = &content_buf[offset_list[i] as usize..offset_list[i+1] as usize];
            string_table.push(s);
        };
        let s = &content_buf[offset_list[offset_list.len()-1] as usize..];
        string_table.push(s);
        // convert to string type
        let string_table = string_table.iter().map(|v| {
            let v = v.strip_suffix(&[0]).unwrap_or(v);
            let s = String::from_utf8_lossy(v).to_string();
            s
        }).collect::<Vec<String>>();

        event_list.iter_mut().for_each(|v| {
            v.resolve_path(&string_table);
            v.resolve_def(&sounddef_list);
        });

        // sounddef_list.iter_mut().for_each(|v| {
        //     v.resolve_path(&string_table);
        // });
        
        Ok(FmodFev {
            proj_name,
            bank_list,
            event_map: event_list.into_iter().map(|v| {
                let path = v.path.join("/");
                (path, v)
            }).collect(),
        })
    }
}

pub mod lua_fmodparse {
    use super::*;
    use rlua::prelude::*;
    use rlua::{UserData, UserDataMethods};

    impl UserData for FmodFev {
        fn add_methods<'lua, T: UserDataMethods<'lua, Self>>(_methods: &mut T) {
            _methods.add_method("get_event", |lua, this, path: String|{
                let prefix = format!("{}/", this.proj_name);
                match path.strip_prefix(&prefix) {
                    Some(path)=> {
                        match this.event_map.get(path) {
                            Some(event)=> {
                                let data = lua.create_table()?;
                                data.set("is_simple", event.is_simple)?;
                                data.set("has_sounddef", event.has_sounddef)?;
                                let mut file_list = vec![];
                                for file in event.ref_file_list.iter() {
                                    let file_data = lua.create_table()?;
                                    file_data.set("path", file.path.clone())?;
                                    file_data.set("bank_name", file.bank_name.clone())?;
                                    file_data.set("file_index", file.file_index)?;
                                    file_data.set("lengthms", file.lengthms)?;
                                    file_list.push(file_data);
                                }
                                data.set("file_list", file_list)?;
                                Ok(Some(data))
                            },
                            None=> Ok(None),
                        }
                    },
                    None=> Ok(None),
                }
            });

            _methods.add_method("proj_name", |lua, this, ()|{
                lua.create_string(&this.proj_name)
            });

            _methods.add_method("bank_list", |lua, this, ()|{
                Ok(this.bank_list.clone())
            });

            _methods.add_method("event_path_list", |lua, this, ()|{
                let mut path_list = vec![];
                for path in this.event_map.keys() {
                    path_list.push(path.clone());
                }
                Ok(path_list)
            });
        }
    }

    pub fn init(lua: LuaContext) -> LuaResult<()> {
        let globals = lua.globals();
        let fmod = lua.create_table()?;

        fmod.set("OpenFev", lua.create_function(|lua, path: String|{
            let mut f = match std::fs::File::open(&path) {
                Ok(f)=> f,
                Err(e)=> return Err(LuaError::RuntimeError(format!("Failed to open fev file: {}", e))),
            };
            let fmod = match FmodFev::parse(f) {
                Ok(fmod)=> fmod,
                Err(e)=> return Err(LuaError::RuntimeError(format!("Failed to parse fev file: {}", e))),
            };
            Ok(fmod)
        })?)?;

        fmod.set("OpenFsb", lua.create_function(|lua, path: String|{
            Ok(())
        })?)?;

        globals.set("Fmod", fmod)?;

        Ok(())
    }
}
