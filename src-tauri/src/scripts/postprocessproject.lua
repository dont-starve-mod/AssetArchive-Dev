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

local Effect = Class(function(self, file)
	if file:endswith(".tex") then
		self.type = "cc"
	elseif file:endswith(".ksh") then
		self.type = "shader"
	else
		error("Failed to infer type from file: "..file)
	end

	self.file = file
	self.percent = 1
	self.solo = false
	self.disabled = false
end)

function Effect:Dumps()
	local result = "CC("..DumpsValue(self.file)
	if type(self.percent) == "number" and self.percent ~= 1 then
		result = result .. ", "..DumpsValue(self.percent)
	end
	result = result .. ")"
	if self.solo then
		result = result..":Solo()"
	end
	if self.disabled then
		result = result..":Disable()"
	end
	return result
end

function Effect:__tostring()
	return string.format("<Effect file=%s>", self.file)
end

local PostProcessProject = Class(function(self)
	self.id = "/"
	self.filename = ""
	self.filepath = nil
	self.is_template = false
	self.error = nil
	self.effects = {}
end)

function PostProcessProject:StrictGetPreviewEffect()
	local e = self:GetSoloEffect()
		or #self.effects == 1 and self.effects[1]
	if e ~= nil and not e.disabled then
		return e
	else
		error("Failed to get preview effect: "..tostring(self))
	end
end

function PostProcessProject:GetSoloEffect()
	local result = nil
	for _, v in ipairs(self.effects)do
		if v.solo then
			-- find redundant solo effect
			if result ~= nil then
				if self.is_template then
					-- use strict checking on template
					error("Found solo effects for more than once: "..tostring(self))
				else
					print("Found solo effects for more than once: "..tostring(self))
				end
			end
			result = v
		end
	end
	return result
end

function PostProcessProject:GetValidEffectList()
	local list = {}
	for _, v in ipairs(self.effects)do
		if v.solo then
			-- note: `solo` has higher priority than `disabled`
			if v.disabled then
				return {}
			else
				return { v } 
			end
		end
		if not v.disabled then
			table.insert(list, v)
		end
	end
	return list
end

function PostProcessProject:__tostring()
	if self.error then
		return string.format("<PostProcessProject id=%s error=%s>", self.id, self.error)
	else
		return string.format("<PostProcessProject id=%s effects=[%d]>", self.id, #self.effects)
	end
end

function PostProcessProject:CreateEnv()
	local env = {
		print = print,
		math = math,
		string = string,
		table = table,
		CC = function(file, percent)
			local e = Effect(file)
			e.percent = percent or 1

			local result = {}
			-- for chaining
			result.Disable = function()
				e.disabled = true
				return result
			end
			result.Solo = function()
				e.solo = true
				return result
			end
			return result
		end
	}
	return env
end

function PostProcessProject:LoadSource(content)
	local fn = loadstring(content)
	if type(fn) ~= "function" then
		self.error = "Failed to eval source: " .. tostring(fn)
		return false
	end
	local env = self:CreateEnv()
	setfenv(fn, env)

