// provide a multi-threaded indexer for anim assets
use zip::ZipArchive;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek};
use std::path::{Path, PathBuf};
use std::error::Error;
use log::{error, warn, info};

type AnimIndex = Vec<(String, u32, u8)>;
type BuildIndex = (String, u32, (f32, f32, f32, f32));
type HashTable = HashMap<u32, Vec<u8>>;

const SWAP_ICON: u32 = 4138393349;

fn load_anim_zip<R>(f: R) -> Result<(Option<AnimIndex>, Option<BuildIndex>, HashTable), String> 
where R: Read + Seek {
    let mut archive = ZipArchive::new(f).map_err(|e| format!("Failed to read zip file: {}", e))?;
    let mut anim_index = None;
    let mut build_index = None;
    let mut hash_table = HashTable::new();
    if let Ok(anim_bin) = archive.by_name("anim.bin") {
        match index_anim_bin(anim_bin) {
            Ok(data)=> {
                anim_index = Some(data.0);
                hash_table.extend(data.1);
            },
            Err(e) => return Err(format!("Failed to index anim.bin: {}", e))
        }
    }
    if let Ok(build_bin) = archive.by_name("build.bin") {
        match index_build_bin(build_bin) {
            Ok(data) => {
                build_index = Some(data.0);
                hash_table.extend(data.1);
            },
            Err(e) => return Err(format!("Failed to index build.bin: {}", e))
        }
    }
    Ok((anim_index, build_index, hash_table))
}

fn parse_hash_table_impl(mut f: impl Read, hash_table: &mut HashTable) -> Result<(), Box<dyn Error>> {
    let mut buf = [0; 4];
    f.read_exact(&mut buf)?;
    let num_hashes = u32::from_le_bytes(buf);
    for _ in 0..num_hashes {
        f.read_exact(&mut buf)?;
        let hash = u32::from_le_bytes(buf);
        f.read_exact(&mut buf)?;
        let len = u32::from_le_bytes(buf);
        let mut name_buf = vec![0; len as usize];
        f.read_exact(&mut name_buf)?;
        hash_table.insert(hash, name_buf);
    }
    Ok(())
}

/// collect hash table at the tail of file.
/// this function skip parsing error
fn parse_hash_table(mut f: impl Read) -> HashTable {
    let mut hash_table = HashTable::new();
    let failed = parse_hash_table_impl(f, &mut hash_table).is_err();
    if failed {
        warn!("Failed to parse hash table");
    }
    hash_table
}

/// load anim.bin file and generate index.
/// return vec[name, bankhash, facing]
fn index_anim_bin(mut f: impl Read) -> Result<(AnimIndex, HashTable), Box<dyn Error>> {
    let mut index = vec![];
    let mut buf = vec![0; 4];
    f.read_exact(&mut buf)?;
    if buf != b"ANIM" {
        return Err("Invalid anim.bin file".into());
    }
    let mut buf = vec![0; 20];
    f.read_exact(&mut buf)?;
    let num_anims = u32::from_le_bytes([buf[16], buf[17], buf[18], buf[19]]);
    for i in 0..num_anims {
        let mut buf = [0; 4];
        f.read_exact(&mut buf)?;
        let anim_name_len = u32::from_le_bytes(buf);
        let mut anim_name_buf = vec![0; anim_name_len as usize];
        f.read_exact(&mut anim_name_buf)?;
        let anim_name = String::from_utf8_lossy(&anim_name_buf).to_string();
        let mut buf = vec![0; 1 + 12];
        f.read_exact(&mut buf)?;
        let facing = buf[0];
        let bankhash = u32::from_le_bytes([buf[1], buf[2], buf[3], buf[4]]);
        // let framerate = u32::from_le_bytes(&buf[5..9]);
        let num_frames = u32::from_le_bytes([buf[9], buf[10], buf[11], buf[12]]);
        for j in 0..num_frames {
            let mut buf = [0; 16];
            f.read_exact(&mut buf)?;
            let mut buf = [0; 4];
            f.read_exact(&mut buf)?;
            let num_events = u32::from_le_bytes(buf) as usize;
            let mut buf = vec![0; num_events * 4];
            f.read_exact(&mut buf)?;
            let mut buf = [0; 4];
            f.read_exact(&mut buf)?;
            let num_elements = u32::from_le_bytes(buf) as usize;
            let mut buf = vec![0; num_elements * 40];
            f.read_exact(&mut buf)?;
        }
        index.push((anim_name, bankhash, facing));
    }
    let hash = parse_hash_table(f);
    Ok((index, hash))
}

/// load build.bin file and generate index
/// return [name, numatlases, swap_icon_0]
fn index_build_bin(mut f: impl Read) -> Result<(BuildIndex, HashTable), Box<dyn Error>> {
    let mut buf = [0; 4];
    f.read_exact(&mut buf)?;
    if &buf != b"BILD" {
        return Err("Invalid build.bin file".into());
    }
    f.read_exact(&mut buf)?;
    f.read_exact(&mut buf)?;
    let num_symbols = u32::from_le_bytes(buf);
    f.read_exact(&mut buf)?;
    f.read_exact(&mut buf)?;
    let name_len = u32::from_le_bytes(buf);
    let mut name_buf = vec![0; name_len as usize];
    f.read_exact(&mut name_buf)?;
    let name = String::from_utf8_lossy(&name_buf).to_string();
    f.read_exact(&mut buf)?;
    let num_atlases = u32::from_le_bytes(buf);
    for i in 0..num_atlases {
        f.read_exact(&mut buf)?;
        let atlas_name_len = u32::from_le_bytes(buf);
        let mut atlas_name_buf = vec![0; atlas_name_len as usize];
        f.read_exact(&mut atlas_name_buf)?;
        // atlas name is not used
    }
    let mut swap_icon_0_data = (-1.0, -1.0, -1.0, -1.0);
    let mut swap_icon_0_index = 0;
    let mut swap_icon_0_num_vertx = 0;
    for i in 0..num_symbols {
        f.read_exact(&mut buf)?;
        let img_hash = u32::from_le_bytes(buf);
        f.read_exact(&mut buf)?;
        let num_imgs = u32::from_le_bytes(buf);
        let mut buf = vec![0; num_imgs as usize * 32];
        f.read_exact(&mut buf)?;
        if img_hash == SWAP_ICON {
            let index = u32::from_le_bytes(buf[0..4].try_into().unwrap());
            let duration = u32::from_le_bytes(buf[4..8].try_into().unwrap());
            let data = (
                f32::from_le_bytes(buf[8..12].try_into().unwrap()),
                f32::from_le_bytes(buf[12..16].try_into().unwrap()),
                f32::from_le_bytes(buf[16..20].try_into().unwrap()),
                f32::from_le_bytes(buf[20..24].try_into().unwrap()));
            let vertex_index = u32::from_le_bytes(buf[24..28].try_into().unwrap());
            let num_verts = u32::from_le_bytes(buf[28..32].try_into().unwrap());
            if i == 0 && index == 0 {
                // first img of symbol `SWAP_ICON`
                swap_icon_0_data = data;
                swap_icon_0_index = index;
                swap_icon_0_num_vertx = num_verts;
            } 
        }
    }
    // TODO: parse vert for swap_icon_0
    let mut buf = [0; 4];
    f.read_exact(&mut buf)?;
    let num_total_verts = u32::from_le_bytes(buf);
    let mut buf = vec![0; num_total_verts as usize * 24];
    f.read_exact(&mut buf)?;
    let hash = parse_hash_table(f);
    Ok(((name, num_atlases, swap_icon_0_data), hash))
}

pub mod lua_fastindex {
    use super::*;
    use std::io::Cursor;
    use rlua::{prelude::{LuaContext, LuaError, LuaResult}, AnyUserData, Value};
    use crate::filesystem::lua_filesystem::Path;

    pub fn init(lua: LuaContext) -> LuaResult<()> {
        let globals = lua.globals();
        let indexer = lua.create_table()?;

        /// load anim zip file and generate index
        /// this function skip parsing error
        indexer.set("LoadAnimZip", lua.create_function(|lua, path_or_file: Value| {
            let data = lua.create_table()?;
            let mut result;
            match path_or_file {
                Value::String(s)=> {
                    result = load_anim_zip(Cursor::new(s.as_bytes()));
                },
                Value::UserData(path)=> {
                    match path.borrow::<Path>() {
                        Ok(path) => {
                            let path = path.get_inner();
                            match File::open(&path) {
                                Ok(f) => {
                                    result = load_anim_zip(f);
                                }
                                Err(e) => {
                                    error!("Failed to open file: {}: {}", path.display(), e);
                                    return Ok(data);
                                }
                            };
                        },
                        Err(e) => return Err(LuaError::RuntimeError(format!("Failed to get path: {}", e))),
                    };
                },
                _=> return Err(LuaError::RuntimeError("Invalid argument type".to_string())),
            };
            match result {
                Ok(result) => {
                    if let Some(index) = result.0 {
                        let anim = lua.create_table()?;
                        let mut i = 0;
                        for (name, bankhash, facing) in index {
                            i += 1;
                            let v = lua.create_table()?;
                            v.set("name", name)?;
                            v.set("bankhash", bankhash)?;
                            v.set("facing", facing)?;
                            anim.set(i, v)?;
                        }
                        data.set("anim", anim)?;
                    }
                    if let Some(index) = result.1 {
                        let build = lua.create_table()?;
                        build.set("name", index.0)?;
                        build.set("numatlases", index.1)?;
                        if index.2.0 != -1.0 {
                            let swap_icon_0 = lua.create_table()?;
                            swap_icon_0.set("x", index.2.0)?;
                            swap_icon_0.set("y", index.2.1)?;
                            swap_icon_0.set("w", index.2.2)?;
                            swap_icon_0.set("h", index.2.3)?;
                            build.set("swap_icon_0", swap_icon_0)?;
                        }
                        data.set("build", vec![build])?; // create an array for Lua iterator
                    }
                    let hash_table = lua.create_table()?;
                    for (hash, name) in result.2 {
                        hash_table.set(hash, lua.create_string(name.as_slice())?)?;
                    }
                    data.set("hash_table", hash_table)?;
                },
                Err(e) => {
                    error!("Failed to index anim zip: {}", e);
                },
            };
            Ok(data)
        })?)?;

        globals.set("Indexer", indexer)?;

        Ok(())
    }
}