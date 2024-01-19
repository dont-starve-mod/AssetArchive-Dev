local Path = FileSystem.Path
local Filenamify = FileSystem.Filenamify

local function DumpsValue(v)
	if type(v) == "string" or type(v) == "number" or type(v) == "boolean" then
		return json.encode_compliant(v)
	elseif v == nil then
		return "nil"
	else
		error("Invalid type of var: "..tostring(v).. " ("..type(v)..")")
	end
end

local API_DEF = {
	{ name = "SetBank", arg_types = {"hash"} },
	{ name = "SetBuild", arg_types = {"string"} },
	{ name = "PlayAnimation", arg_types = {"string"} },
	{ name = "SetBankAndPlayAnimation", arg_types = {"hash", "string"} },

	{ name = "SetSkin", redirect = "SetBuild" },
	{ name = "PushAnimation", redirect = "PlayAnimation" },
	{ name = "SetPercent", redirect = "PlayAnimation" },

	{ name = "AddOverrideBuild", arg_types = {"string"}},
	{ name = "OverrideSymbol", arg_types = {"hash", "string", "hash"} },
	{ name = "ClearOverrideSymbol", arg_types = {"hash"} },
	{ name = "OverrideSkinSymbol", redirect = "OverrideSymbol" },

	{ name = "Show", arg_types = {"hash"} },
	{ name = "Hide", arg_types = {"hash"} },
	{ name = "ShowSymbol", arg_types = {"hash"} },
	{ name = "HideSymbol", arg_types = {"hash"} },
	{ name = "ShowLayer", redirect = "Show" },
	{ name = "HideLayer", redirect = "Hide" },

	{ name = "SetMultColour", arg_types = {"percent", "percent", "percent", "percent"} },
	{ name = "SetAddColour", arg_types = {"percent", "percent", "percent", "percent"} },

	{ name = "SetSymbolAddColour", arg_types = {"hash", "percent", "percent", "percent", "percent"} },
	{ name = "SetSymbolMultColour", arg_types = {"hash", "percent", "percent", "percent", "percent"} },
}

for _, v in ipairs(API_DEF)do
	API_DEF[v.name] = v
end

local API_IGNORED = {
	"Pause", "Resume",
	"SetOrientation",
	"SetSymbolBloom",
	"SetOceanBlendParams",
	"SetBloomEffectHandle",
}

API_IGNORED = ToIndexTable(API_IGNORED)

-- an api command call, for example: SetBank("wilson")
Api = Class(function(self, name, args)
	self.name = name
	self.args = args
	self.args_warning = {}
	self:CheckName()
	self:CheckArgs()
end)

function Api:CheckName()
	if API_IGNORED[self.name] then
		self:SetWarning("API_IGNORED")
	elseif API_DEF[self.name] then
		local def = API_DEF[self.name]
		if def.redirect then
			self:SetRedirectFrom(self:Dumps())
			self.name = def.redirect
		end
	elseif self.name:startswith("Get") then
		self:SetWarning("API_IGNORED_GET")
	else
		self:SetWarning("API_UNKNOWN")
	end
end

function Api:CheckArgType(expect, value)
	local t = type(value)
	if expect == "string" or expect == "number" then
		return t == expect
	elseif expect == "hash" then
		return t == "string" or t == "number" and value >= 0 and value <= 4294967295
	elseif expect == "percent" then
		return t == "number" and value >= 0 and value <= 1
	end
end

function Api:CheckArgs()
	if self.warning == nil then
		local def = API_DEF[self.name]
		for i,v in ipairs(def.arg_types)do
			if not self:CheckArgType(v, self.args[i]) then
				self.args_warning[i] = { expect = v, value = self.args[i] }
			else
				self.args_warning[i] = nil
			end
		end
	end
end

function Api:SetError(msg)
	self.error = msg
end

function Api:SetWarning(msg)
	self.warning = msg
end

function Api:SetRedirectFrom(msg)
	self.redirect_from = msg
end

function Api:Disable()
	self.disabled = true
end

function Api:Dumps()
	local arglist = {}
	for _,v in ipairs(self.args)do
		table.insert(arglist, DumpsValue(v))
	end
	arglist = table.concat(arglist, ", ")
	local s = string.format("%s(%s)", self.name, arglist)
	if self.disabled then
		s = s.. ":Disable()"
	end
	return s
end

-- a project file to define how to render your DS/DST animation
AnimProject = Class(function(self)
	self.cmds = {}
	self.ignored_cmds = {}
	self.invalid_cmds = {}
end)

function AnimProject:CreateEnv()
	local env = {
		print = print,
		math = math,
		string = string,
		table = table,
	}
	for _, def in ipairs(API_DEF)do
		env[def.name] = function(...)
			local api = {name = def.name, args = {...}}
			table.insert(self.cmds, api)
			return { Disable = function() api.disabled = true end }
		end
	end
	for name in ipairs(API_IGNORED)do
		env[name] = function(...)
			local line = debug.getinfo(2).currentline
			table.insert(self.ignored_cmds, {name = name, line = line})
			return { Disable = function() end }
		end
	end
	local index = function(_, k)
		return function(...)
			local line = debug.getinfo(2).currentline
			print("Warning: API `"..k.."` is invalid (line "..line..")")
			table.insert(self.invalid_cmds, {name = k, line = line})
			return { Disable = function() end }
		end
	end
	-- anim:xxxxx() sugar
	env.anim = setmetatable({}, {__index = function(_, k)
		return function()
			print(k)
		end
	end})
	setmetatable(env, {__index = index})
	return env
end

function AnimProject:LoadSource(content)
	local fn = loadstring(content)
	if type(fn) ~= "function" then
		self.error = "Failed to eval source: " .. tostring(fn)
		return false
	end
	local env = self:CreateEnv()
	setfenv(fn, env)
	-- TODO: unstrict mode?
	local success, result = pcall(fn)
	if not success then
		self.error = "Failed to exec: " .. tostring(result)
		return false
	end

	self.env = setmetatable(env, nil)
	self.title = env.title
	self.description = env.description
	self.facing = env.facing
	self.preview_scale = env.preview_scale

	return true
end

function AnimProject:LoadFile(path)
	local f = FileSystem.CreateReader(path)
	if f == nil then
		error("Failed to open anim project file: "..path)
	end
	return self:LoadSource(f:read_to_end())
end

function AnimProject:__tostring()
	if self.error then
		return string.format("AnimProject<error=%s>", self.error)
	else
		return string.format("AnimProject<title=%s cmds[%d]>", tostring(self.title), #self.cmds)
	end
end

function AnimProject:Serialize(opts)
	local data = opts or {}
	data.title = self.title
	data.description = self.description
	data.cmds = self.cmds
	data.ignored_cmds = self.ignored_cmds
	data.invalid_cmds = self.invalid_cmds
	data.facing = self.facing
	data.preview_scale = self.preview_scale
	return data
end

function AnimProject.Static_ToFile(data)
	local content = {}
	-- basic
	table.insert(content, "title = "..DumpsValue(data.title))
	table.insert(content, "description = "..DumpsValue(data.description))
	table.insert(content, "")
	-- api
	for _,v in ipairs(data.cmds)do
		local api = Api(v.name, v.args)
		if v.disabled then
			api:Disable()
		end
		table.insert(content, api:Dumps())
	end
	-- optional misc
	if data.facing then
		table.insert(content, "facing = "..DumpsValue(data.facing))
	end
	if data.preview_scale then
		table.insert(content, "preview_scale = "..DumpsValue(data.preview_scale))
	end
	return table.concat(content, "\n")
end

function AnimProject:ToFile(opts)
	local data = self:Serialize(opts)
	return AnimProject.Static_ToFile(data)
end

function AnimProject:SerializeError(opts)
	local data = opts or {}
	data.error = self.error
	return data
end

-- manager for anim project and template
local AnimProjectManager = Class(function(self, basedir)
	if type(basedir) == "nil" then
		basedir = APP_DATA_DIR/"animproject"
	elseif type(basedir) == "string" then
		basedir = Path(basedir)
	end

	assert(basedir:create_dir(), "Failed to create animproject dir")

	self.basedir = basedir
	self:LoadTemplate()
	self:LoadProject()
end)

function AnimProjectManager:LoadTemplate()
	self.template_list = {}

	local static_loader = nil
	for k,v in pairs(package.loaders)do
		if type(v) == "userdata" then
			static_loader = v
			break
		end
	end

	for _,v in ipairs{"attack", "beefalo", "tree", "firesuppressor_placer"}do
		local source = static_loader:get_source("anim_template." .. v)
		assert(source ~= "", "Failed to load template source: "..v)
		local project = AnimProject()
		assert(project:LoadSource(source), project.error)
		table.insert(self.template_list, project:Serialize({id = v, readonly = true}))
	end
end

function AnimProjectManager:LoadProject()
	self.project_list = {}
	for _,v in ipairs(self.basedir:iter_file_with_extension(".lua"))do
		local name = v:name()
		local mtime = v:mtime()
		local success, content = pcall(function() return v:read_to_string() end)
		if success and #content > 0 then
			local project = AnimProject()
			if project:LoadSource(content) then
				table.insert(self.project_list, project:Serialize({id = name, mtime = mtime}))
			else
				print(project.error)
			end
		end
	end
end

function AnimProjectManager:ReloadProjectById(id, project)
	if project == nil then
		local path = self.basedir/id
		local mtime = path:mtime()
		local success, content = pcall(function() return path:read_to_string() end)
		if success and #content > 0 then
			project = AnimProject()
			if not project:LoadSource(content) then
				error("Failed to reload project: "..id)
			end
			project = project:Serialize({id = id, mtime = mtime})
		else
			error("Failed to read project file content: "..id)
		end
	end
	for i,v in ipairs(self.project_list)do
		if v.id == id then
			self.project_list[i] = project
			return project
		end
	end
	table.insert(self.project_list, project)
	return project
end

function AnimProjectManager:NewUid(title, prefix)
	local name = Filenamify(title)
	local basedir = self.basedir
	for i = 1, 100 do
		local random_string = "_"
		for i = 1, 5 do
			random_string = random_string .. (math.random() < 0.5 and
				string.char(math.random(65, 90)) or string.char(math.random(97, 122)))
		end
		local fullname = name .. random_string .. (prefix or ".lua")
		local fullpath = basedir/fullname
		if not fullpath:exists() then
			return fullname, fullpath
		end
	end
	error("Failed to generate new uid: infinite loop")
end

function AnimProjectManager:OnIpc(param)
	-- list
	if param.type == "list" then
		return {
			template = self.template_list,
			project = self.project_list,
		}
	-- load/save
	elseif param.type == "load" then
		local id = param.id
		local project = self:ReloadProjectById(id)
		project.is_editing = true
		return project
	elseif param.type == "save" then
		local data = param.data
		local id = data.id
		local facing = data.render_param.facing
		local api_list = data.api_list
		local path = self.basedir/id
		local old = self:ReloadProjectById(id) or {}

		path:write(AnimProject.Static_ToFile({
			title = old.title,
			description = old.description,
			cmds = api_list,
		}))
		return true
	end
	-- create | duplicate | use_template | change | delete
	local id = param.id
	local from_id = param.from_id
	local title = param.title or "未命名"
	local description = param.description
	local new_id = nil
 	if param.type == "create" then
		local id, path = self:NewUid(title)
		local project = AnimProject()
		new_id = id
		project.title = title
		project.description = description
		local data = project:Serialize{id = new_id, mtime = math.floor(now_s())}
		self:ReloadProjectById(id, data)
		path:write(AnimProject.Static_ToFile(data))
	elseif param.type == "duplicate" then
		assert(type(from_id) == "string", "Duplicate project: from_id not provided")
		local id, path = self:NewUid(title)
		new_id = id
		local success, content = pcall(function() return (self.basedir/from_id):read_to_string() end)
		if success and #content > 0 then
			local project = AnimProject()
			if project:LoadSource(content) then
				project.title = title
				project.description = description
				local data = project:Serialize({id = new_id, mtime = math.floor(now_s())})
				table.insert(self.project_list, data)
				path:write(AnimProject.Static_ToFile(data))
			else
				error("Failed to load project: "..id.."\n"..project.error)
			end
		end
	elseif param.type == "use_template" then
		assert(type(from_id) == "string", "Use template: from_id not provided")
		local id, path = self:NewUid(title)
		new_id = id
		local template
		for _,v in ipairs(self.template_list)do
			if v.id == from_id then
				template = json.decode(json.encode(v))
			end
		end
		if template == nil then
			error("Invalid template id: "..from_id)
		end
		local data = template
		data.title = title
		data.description = description
		data.mtime = math.floor(now_s())
		table.insert(self.project_list, data)
		path:write(AnimProject.Static_ToFile(data))
	elseif param.type == "change" then
		assert(type(id) == "string", "Change project: id not provided")
		for i,v in ipairs(self.project_list)do
			if v.id == id then
				v.title = param.title or v.title
				v.description = param.description or v.description
				-- v.facing = param.facing or v.facing
				-- v.preview_scale = param.preview_scale or v.preview_scale
				v.mtime = math.floor(now_s())
				local path = self.basedir/id
				path:write(AnimProject.Static_ToFile(v))
			end

			-- TODO: title will change id
		end
	elseif param.type == "delete" then
		local id = param.id
		local path = self.basedir/id
		if path:is_file() then
			path:delete()
			print("Delete project: "..tostring(path))
		end
		for i,v in pairs(self.project_list)do
			if v.id == id then
				table.remove(self.project_list, i)
				break
			end
		end
	end

	-- debug check data type
	for _,v in ipairs(self.project_list)do
		assert(getmetatable(v) == nil)
		assert(v.id, "Field `id` is required")
		assert(v.mtime, "Field `mtime` is required")
	end

	return {
		new_id = new_id,
		project = self.project_list,
	}
end

-- AnimProjectManager(); exit()

return {
	AnimProjectManager = AnimProjectManager
}