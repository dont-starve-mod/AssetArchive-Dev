// provide a multi-threaded indexer for anim assets
use zip::ZipArchive;
use std::fs::File;
use std::io::{Read, Seek};
use std::path::{Path, PathBuf};
use std::error::Error;

type AnimIndex = Vec<(String, u32, u8)>;
type BuildIndex = (String, u32, (f32, f32, f32, f32));

const SWAP_ICON: u32 = 4138393349;

fn load_anim_zip(path: PathBuf) -> Result<(Option<AnimIndex>, Option<BuildIndex>), String> {
    let f = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut archive = ZipArchive::new(f).map_err(|e| format!("Failed to read zip file: {}", e))?;
    let mut anim_index = None;
    let mut build_index = None;
    if let Ok(anim_bin) = archive.by_name("anim.bin") {
        match index_anim_bin(anim_bin) {
            Ok(index)=> anim_index = Some(index),
            Err(e) => return Err(format!("Failed to index anim.bin: {}", e))
        }
    }
    if let Ok(build_bin) = archive.by_name("build.bin") {
        match index_build_bin(build_bin) {
            Ok(index) => build_index = Some(index),
            Err(e) => return Err(format!("Failed to index build.bin: {}", e))
        }
    }
    Ok((anim_index, build_index))
}

/// load anim.bin file and generate index
/// return vec[name, bankhash, facing]
fn index_anim_bin(mut f: impl Read) -> Result<AnimIndex, Box<dyn Error>> {
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
    Ok(index)
}

/// load build.bin file and generate index
/// return [name, numatlases, swap_icon_0]

/*


-- loader for <build.bin>
BuildLoader = Class(function(self, f, lazy)
    local function error(e)
        self.error = e
        funcprint("Error in BuildLoader._ctor(): "..e)
        f:close()
    end

    if f:read_string(4) ~= "BILD" then
        return error("BILD file sig not satisfied")
    end

    f:seek_forward(4)
    local numsymbols = f:read_u32()
    f:seek_forward(4)
    local name = f:read_variable_length_string()
    local numatlases = f:read_u32()
    if numatlases == nil then
        return error(ERROR.UNEXPECTED_EOF)
    end

    if not name:is_utf8() then
        self.invalid_utf8 = true
    end

    self.buildname = name
    self.numatlases = numatlases
    self.atlas = {}
    self.lazy = lazy

    for i = 1, numatlases do
        local name = f:read_variable_length_string()
        if name ~= nil then
            if not name:is_utf8() then
                self.invalid_utf8 = true
            end
            table.insert(self.atlas, name)
        else
            return error(ERROR.UNEXPECTED_EOF)
        end
    end

    local allimgs = {}
    local symbol = {}
    local symbol_collection = {}
    for i = 1, numsymbols do
        local imghash = f:read_u32()
        local numimgs = f:read_u32()
        if numimgs == nil then
            return error(ERROR.UNEXPECTED_EOF)
        end
        table.insert(symbol_collection, imghash)
        if lazy and imghash ~= self.SWAP_ICON then
            f:seek_forward(numimgs * 32)
        else
            local imgs = { imghash = imghash, imglist = {} }
            for j = 1, numimgs do
                local img = {
                    index = f:read_u32(),
                    duration = f:read_u32(),
                    x = f:read_f32(),
                    y = f:read_f32(),
                    w = f:read_f32(),
                    h = f:read_f32(),
                    vertexindex = f:read_u32(),
                    numvertexs = f:read_u32(),
                }
                if img.numvertexs == nil then
                    return error(ERROR.UNEXPECTED_EOF)
                end
                table.insert(imgs.imglist, img)
                table.insert(allimgs, img)
            end
            
            if imghash == SWAP_ICON then
                if #imgs.imglist >= 1 and imgs.imglist[1].index == 0 then
                    self.swap_icon_0 = imgs.imglist[1]
                else
                    print("Warning: failed to get first image from symbol `SWAP_ICON`")
                end
            end

            table.insert(symbol, imgs)
        end
    end

    local totalnumvertexs = f:read_u32()
    if totalnumvertexs == nil then
        return error(ERROR.UNEXPECTED_EOF)
    end

    -- only parse swap_icon_0 in lazy mode
    if lazy then
        allimgs = { self.swap_icon_0 }
        if self.swap_icon_0 ~= nil then
            f:seek_forward(self.swap_icon_0.vertexindex* 24)
        end
    end

    for i, img in ipairs(allimgs) do
        if img.numvertexs == 0 then
            img.blank = true
        else
            local x, y, w, h = img.x, img.y, img.w, img.h
            local x_offset, y_offset = x - w/2, y - h/2

            local temp = {
                sampler = {},       -- index of texture (atlas-0.tex -> 0)
                bbx = {}, bby = {}, -- bbox left-top coord
                cw =  {}, ch =  {}, -- normalized canvas size
            }

            for j = 1, img.numvertexs / 6 do
                -- sampler = data[5]  # 0,5 
                -- left    = data[0]  # 0,0 
                -- right   = data[6]  # 1,0 
                -- top     = data[1]  # 0,1 
                -- bottom  = data[13] # 2,1
                -- umin    = data[3]  # 0,3 
                -- umax    = data[9]  # 1,3 
                -- vmin    = data[4]  # 0,4 
                -- vmax    = data[16] # 2,4
                local left = f:read_f32()   -- 0
                local top = f:read_f32()    -- 1
                f:seek_forward(4)
                local umin = f:read_f32()   -- 3
                local vmin = f:read_f32()   -- 4
                local sampler = f:read_f32()-- 5
                local right = f:read_f32()  -- 6
                f:seek_forward(8)
                local umax = f:read_f32()   -- 9
                f:seek_forward(12)
                local bottom = f:read_f32() -- 13
                f:seek_forward(8)
                local vmax = f:read_f32()   -- 16
                f:seek_forward(19*4)

                local cw = (right - left) / max(umax - umin, .00001)
                local ch = (top - bottom) / min(vmax - vmin, -.00001)
                local bbx = umin * cw - (left - x_offset)
                local bby = (1-vmin) * ch - (top - y_offset)

                table.insert(temp.sampler, sampler)
                table.insert(temp.bbx, bbx)
                table.insert(temp.bby, bby)
                table.insert(temp.cw, cw)
                table.insert(temp.ch, ch)
            end

            img.sampler = math.floor(median(temp.sampler) + 0.5)
            img.bbx = round2(median(temp.bbx))
            img.bby = round2(median(temp.bby))
            img.cw = round2(median(temp.cw))
            img.ch = round2(median(temp.ch))

            if not lazy then
                img.vertexindex = nil
                img.numvertexs = nil
            end
        end
    end

    self.builddata = {name = name, atlas = self.atlas, symbol = symbol}
    self.symbol_map = {}
    self.symbol_collection = symbol_collection
    for _,v in ipairs(symbol)do
        self.symbol_map[v.imghash] = v
    end

    if lazy then
        if self.swap_icon_0 then
            f:seek_forward((totalnumvertexs - self.swap_icon_0.vertexindex - self.swap_icon_0.numvertexs)* 24)
            HashLib:ParseFile(f)
        end
    else
        HashLib:ParseFile(f)
    end

    f:close()
end)*/
fn index_build_bin(mut f: impl Read) -> Result<BuildIndex, Box<dyn Error>> {
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
            let num_vertexs = u32::from_le_bytes(buf[28..32].try_into().unwrap());
            if i == 0 && index == 0 {
                // first img of symbol `SWAP_ICON`
                swap_icon_0_data = data;
            } 
        }
    }
    Ok((name, num_atlases, swap_icon_0_data))
}

pub mod lua_fastindex {
    use super::*;
    use rlua::prelude::{LuaResult, LuaContext, LuaError};
    use crate::filesystem::lua_filesystem::Path;

    pub fn init(lua: LuaContext) -> LuaResult<()> {
        let globals = lua.globals();
        let indexer = lua.create_table()?;    
        indexer.set("LoadAnimZip", lua.create_function(|lua, path: Path| {
            match load_anim_zip(path.get_inner()) {
                Ok(result) => {
                    let data = lua.create_table()?;
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
                    Ok(data)
                },
                Err(e) => Err(LuaError::RuntimeError(e)),
            }
        })?)?;

        globals.set("Indexer", indexer)?;

        Ok(())
    }
}