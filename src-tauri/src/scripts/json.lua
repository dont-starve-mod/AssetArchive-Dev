-----------------------------------------------------------------------------
-- JSON4Lua: JSON encoding / decoding support for the Lua language.
-- json Module.
-- Author: Craig Mason-Jones
-- Homepage: http://json.luaforge.net/
-- Version: 0.9.40
-- This module is released under the MIT License (MIT).
-- Please see LICENCE.txt for details.
--
-- USAGE:
-- This module exposes two functions:
--   encode(o)
--     Returns the table / string / boolean / number / nil / json.null value as a JSON-encoded string.
--   decode(json_string)
--     Returns a Lua object populated with the data encoded in the JSON string json_string.
--
-- REQUIREMENTS:
--   compat-5.1 if using Lua 5.0
--
-- CHANGELOG
--   0.9.20 Introduction of local Lua functions for private functions (removed _ function prefix).
--          Fixed Lua 5.1 compatibility issues.
--   		Introduced json.null to have null values in associative arrays.
--          encode() performance improvement (more than 50%) through table.concat rather than ..
--          Introduced decode ability to ignore /**/ comments in the JSON string.
--   0.9.10 Fix to array encoding / decoding to correctly manage nil/null values in arrays.

--[[

    The MIT License

    Copyright (c) 2009 Craig Mason-Jones

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.

--]]

-----------------------------------------------------------------------------

-----------------------------------------------------------------------------
-- Imports and dependencies
-----------------------------------------------------------------------------
local math = require('math')
local string = require("string")
local table = require("table")

_G.tracked_assert = _G.assert

local base = _G
-- faster encoder defined in core
local EncodeString2 = _G.Algorithm.EncodeString
-----------------------------------------------------------------------------
-- Module declaration
-----------------------------------------------------------------------------
module("json")

-- Public functions

-- Private functions
local decode_scanArray
local decode_scanComment
local decode_scanConstant
local decode_scanNumber
local decode_scanObject
local decode_scanString
local decode_scanWhitespace
local encodeString
local isArray
local isEncodable

-----------------------------------------------------------------------------
-- PUBLIC FUNCTIONS
-----------------------------------------------------------------------------

-----------------------------------------------------------------------------
-- WARNING: encode() is not compliant with json standards, only use this for
-- game data. If you are sending data to another service (eg, analytics,
-- leaderboards, etc) then use encode_compliant()
-----------------------------------------------------------------------------
--- Encodes an arbitrary Lua object / variable.
-- @param v The Lua object / variable to be JSON encoded.
-- @return String containing the JSON encoding in internal Lua string format (i.e. not unicode)
function encode (v)
  -- Handle nil values
  if v==nil then
    return "null"
  end

  local vtype = base.type(v)

  -- Handle strings
  if vtype=='string' then
    return '"' .. encodeString(v) .. '"'	    -- Need to handle encoding in string
  end

  -- Handle booleans
  if vtype=='number' or vtype=='boolean' then
    return base.tostring(v)
  end

  -- Handle tables
  if vtype=='table' then
    local rval = {}
    -- Consider arrays separately
    local bArray, maxCount = isArray(v)
    if bArray then
      for i = 1,maxCount do
        table.insert(rval, encode(v[i]))
      end
    else	-- An object, not an array
      for i,j in base.pairs(v) do
        if isEncodable(i) and isEncodable(j) then
          table.insert(rval, '"' .. encodeString(i) .. '":' .. encode(j))
        end
      end
    end
    if bArray then
      return '[' .. table.concat(rval,',') ..']'
    else
      return '{' .. table.concat(rval,',') .. '}'
    end
  end

  -- Handle null values
  if vtype=='function' and v==null then
    return 'null'
  end

  if not (false) then
    base.tracked_assert(false,'encode attempt to encode unsupported type ' .. vtype .. ':' .. base.tostring(v))
  end
end

function encode_pretty (v, depth)
  depth = depth or 0
  -- Handle nil values
  if v==nil then
    return "null"
  end

  local vtype = base.type(v)

  -- Handle strings
  if vtype=='string' then
    return '"' .. encodeString(v) .. '"'      -- Need to handle encoding in string
  end

  -- Handle booleans
  if vtype=='number' or vtype=='boolean' then
    return base.tostring(v)
  end

  -- Handle tables
  if vtype=='table' then
    local rval = {}
    -- Consider arrays separately
    local bArray, maxCount = isArray(v)
    if bArray then
      for i = 1,maxCount do
        table.insert(rval, encode_pretty(v[i], depth + 1))
      end
    else  -- An object, not an array
      for i,j in base.pairs(v) do
        if isEncodable(i) and isEncodable(j) then
          table.insert(rval, '"' .. encodeString(i) .. '":' .. encode_pretty(j, depth + 1))
        end
      end
    end
    if bArray then
      return '[\n' .. table.concat(rval,',\n') ..'\n]'
    else
      return '{\n' .. 
        string.rep("  ", depth)..table.concat(rval,',\n'..string.rep("  ", depth)) .. 
        '\n}'
    end
  end

  -- Handle null values
  if vtype=='function' and v==null then
    return 'null'
  end

  if not (false) then
    base.tracked_assert(false,'encode attempt to encode unsupported type ' .. vtype .. ':' .. base.tostring(v))
  end
end


--- Encodes a string to be JSON-compliant, only use in encode_compliant(v).
function encodeString_compliant(s)
  s = string.gsub(s,'\\','\\\\')
  s = string.gsub(s,'"','\\"')
  --s = string.gsub(s,"'","\\'") -- json standards do not support escaping single quotes
  s = string.gsub(s,'\n','\\n')
  s = string.gsub(s,'\t','\\t')
  s = string.gsub(s,'\r','\\r')
  return s
end

-- use faster encoder from core
encodeString_compliant = EncodeString2

-- Use this function only if you are sending data out to a web service or some other external system. The game will not be able to decode this data.
-- The supplied encodeString/decodeString function does not produce valid json files. This is okay for the save/load system but not when sending data out to the internet.
-- NOTE: Never add decode support from encode_compliant's returned string. This output may change without warning if new bugs in the original code are found.
function encode_compliant(v)
  -- Handle nil values
  if v==nil then
    return "null"
  end

  local vtype = base.type(v)

  -- Handle strings
  if vtype=='string' then
    return '"' .. encodeString_compliant(v) .. '"'	    -- Need to handle encoding in string
  end

  -- Handle booleans
  if vtype=='number' or vtype=='boolean' then
    return base.tostring(v)
  end

  -- Handle tables
  if vtype=='table' then
    local rval = {}
    -- Consider arrays separately
    local bArray, maxCount = isArray(v)
    if bArray then
      for i = 1,maxCount do
        table.insert(rval, encode_compliant(v[i]))
      end
    else	-- An object, not an array
      for i,j in base.pairs(v) do
        if isEncodable(i) and isEncodable(j) then
          table.insert(rval, '"' .. encodeString_compliant(i) .. '":' .. encode_compliant(j))
        end
      end
    end
    if bArray then
      return '[' .. table.concat(rval,',') ..']'
    else
      return '{' .. table.concat(rval,',') .. '}'
    end
  end

  -- Handle null values
  if vtype=='function' and v==null then
    return 'null'
  end

  if not (false) then
    base.tracked_assert(false,'encode_compliant attempt to encode unsupported type ' .. vtype .. ':' .. base.tostring(v))
  end
end

--- Decodes a JSON string and returns the decoded value as a Lua data structure / value.
-- @param s The string to scan.
-- @param [startPos] Optional starting position where the JSON string is located. Defaults to 1.
-- @param Lua object, number The object that was scanned, as a Lua table / string / number / boolean or nil,
-- and the position of the first character after
-- the scanned JSON object.
function decode(s, startPos)
  startPos = startPos and startPos or 1
  startPos = decode_scanWhitespace(s,startPos)
  if not (startPos<=string.len(s)) then
    base.tracked_assert(startPos<=string.len(s), 'Unterminated JSON encoded object found at position ['..base.tostring(startPos) ..'] in [' .. s .. ']')
  end

  local curChar = string.sub(s,startPos,startPos)
  -- Object
  if curChar=='{' then
    return decode_scanObject(s,startPos)
  end
  -- Array
  if curChar=='[' then
    return decode_scanArray(s,startPos)
  end
  -- Number
  if string.find("+-0123456789.e", curChar, 1, true) then
    return decode_scanNumber(s,startPos)
  end
  -- String
  if curChar==[["]] or curChar==[[']] then
    return decode_scanString(s,startPos)
  end
  if string.sub(s,startPos,startPos+1)=='/*' then
    return decode(s, decode_scanComment(s,startPos))
  end
  -- Otherwise, it must be a constant
  return decode_scanConstant(s,startPos)
end

--- The null function allows one to specify a null value in an associative array (which is otherwise
-- discarded if you set the value with 'nil' in Lua. Simply set t = { first=json.null }
function null()
  return null -- so json.null() will also return null ;-)
end
-----------------------------------------------------------------------------
-- Internal, PRIVATE functions.
-- Following a Python-like convention, I have prefixed all these 'PRIVATE'
-- functions with an underscore.
-----------------------------------------------------------------------------

--- Scans an array from JSON into a Lua object
-- startPos begins at the start of the array.
-- Returns the array and the next starting position
-- @param s The string being scanned.
-- @param startPos The starting position for the scan.
-- @return table, int The scanned array as a table, and the position of the next character to scan.
function decode_scanArray(s,startPos)
  local array = {}	-- The return value
  local stringLen = string.len(s)
  if not (string.sub(s,startPos,startPos)=='[') then
    base.tracked_assert(string.sub(s,startPos,startPos)=='[','decode_scanArray called but array does not start at position ' .. startPos .. ' in string:\n'..s )
  end
  startPos = startPos + 1
  -- Infinite loop for array elements
  repeat
    startPos = decode_scanWhitespace(s,startPos)
    if not (startPos<=stringLen) then
      base.tracked_assert(startPos<=stringLen,'JSON String ended unexpectedly scanning array.')
    end
    local curChar = string.sub(s,startPos,startPos)
    if (curChar==']') then
      return array, startPos+1
    end
    if (curChar==',') then
      startPos = decode_scanWhitespace(s,startPos+1)
    end
    if not (startPos<=stringLen) then
      base.tracked_assert(startPos<=stringLen, 'JSON String ended unexpectedly scanning array.')
    end
    object, startPos = decode(s,startPos)
    table.insert(array,object)
  until false
end

--- Scans a comment and discards the comment.
-- Returns the position of the next character following the comment.
-- @param string s The JSON string to scan.
-- @param int startPos The starting position of the comment
function decode_scanComment(s, startPos)
  if not (string.sub(s,startPos,startPos+1)=='/*') then
    base.tracked_assert( string.sub(s,startPos,startPos+1)=='/*', "decode_scanComment called but comment does not start at position " .. startPos)
  end
  local endPos = string.find(s,'*/',startPos+2)
  if not (endPos~=nil) then
    base.tracked_assert(endPos~=nil, "Unterminated comment in string at " .. startPos)
  end
  return endPos+2
end

--- Scans for given constants: true, false or null
-- Returns the appropriate Lua type, and the position of the next character to read.
-- @param s The string being scanned.
-- @param startPos The position in the string at which to start scanning.
-- @return object, int The object (true, false or nil) and the position at which the next character should be
-- scanned.
function decode_scanConstant(s, startPos)
  local consts = { ["true"] = true, ["false"] = false, ["null"] = nil }
  local constNames = {"true","false","null"}

  for i,k in base.pairs(constNames) do
    --print ("[" .. string.sub(s,startPos, startPos + string.len(k) -1) .."]", k)
    if string.sub(s,startPos, startPos + string.len(k) -1 )==k then
      return consts[k], startPos + string.len(k)
    end
  end
  if not (nil) then
    base.tracked_assert(nil, 'Failed to scan constant at starting position ' .. base.tostring(startPos) .. ' from string ' .. s)
  end
end

--- Scans a number from the JSON encoded string.
-- (in fact, also is able to scan numeric +- eqns, which is not
-- in the JSON spec.)
-- Returns the number, and the position of the next character
-- after the number.
-- @param s The string being scanned.
-- @param startPos The position at which to start scanning.
-- @return number, int The extracted number and the position of the next character to scan.
function decode_scanNumber(s,startPos)
  local endPos = startPos+1
  local stringLen = string.len(s)
  local acceptableChars = "+-0123456789.e"
  while (string.find(acceptableChars, string.sub(s,endPos,endPos), 1, true)
	and endPos<=stringLen
	) do
    endPos = endPos + 1
  end
  local stringValue = 'return ' .. string.sub(s,startPos, endPos-1)
  local stringEval = base.loadstring(stringValue)
  if not (stringEval) then
    base.tracked_assert(stringEval, 'Failed to scan number [ ' .. stringValue .. '] in JSON string at position ' .. startPos .. ' : ' .. endPos)
  end
  return stringEval(), endPos
end

--- Scans a JSON object into a Lua object.
-- startPos begins at the start of the object.
-- Returns the object and the next starting position.
-- @param s The string being scanned.
-- @param startPos The starting position of the scan.
-- @return table, int The scanned object as a table and the position of the next character to scan.
function decode_scanObject(s,startPos)
  local object = {}
  local stringLen = string.len(s)
  local key, value
  if not (string.sub(s,startPos,startPos)=='{') then
    base.tracked_assert(string.sub(s,startPos,startPos)=='{','decode_scanObject called but object does not start at position ' .. startPos .. ' in string:\n' .. s)
  end
  startPos = startPos + 1
  repeat
    startPos = decode_scanWhitespace(s,startPos)
    if not (startPos<=stringLen) then
      base.tracked_assert(startPos<=stringLen, 'JSON string ended unexpectedly while scanning object.')
    end
    local curChar = string.sub(s,startPos,startPos)
    if (curChar=='}') then
      return object,startPos+1
    end
    if (curChar==',') then
      startPos = decode_scanWhitespace(s,startPos+1)
    end
    if not (startPos<=stringLen) then
      base.tracked_assert(startPos<=stringLen, 'JSON string ended unexpectedly scanning object.')
    end
    -- Scan the key
    key, startPos = decode(s,startPos)
    if not (startPos<=stringLen) then
      base.tracked_assert(startPos<=stringLen, 'JSON string ended unexpectedly searching for value of key ' .. key)
    end
    startPos = decode_scanWhitespace(s,startPos)
    if not (startPos<=stringLen) then
      base.tracked_assert(startPos<=stringLen, 'JSON string ended unexpectedly searching for value of key ' .. key)
    end
    if not (string.sub(s,startPos,startPos)==':') then
      base.tracked_assert(string.sub(s,startPos,startPos)==':','JSON object key-value assignment mal-formed at ' .. startPos)
    end
    startPos = decode_scanWhitespace(s,startPos+1)
    if not (startPos<=stringLen) then
      base.tracked_assert(startPos<=stringLen, 'JSON string ended unexpectedly searching for value of key ' .. key)
    end
    value, startPos = decode(s,startPos)
    object[key]=value
  until false	-- infinite loop while key-value pairs are found
end

--- Scans a JSON string from the opening inverted comma or single quote to the
-- end of the string.
-- Returns the string extracted as a Lua string,
-- and the position of the next non-string character
-- (after the closing inverted comma or single quote).
-- @param s The string being scanned.
-- @param startPos The starting position of the scan.
-- @return string, int The extracted string as a Lua string, and the next character to parse.
function decode_scanString(s,startPos)
  if not (startPos) then
    base.tracked_assert(startPos, 'decode_scanString(..) called without start position')
  end
  local startChar = string.sub(s,startPos,startPos)
  if not (startChar==[[']] or startChar==[["]]) then
    base.tracked_assert(startChar==[[']] or startChar==[["]],'decode_scanString called for a non-string')
  end
  local escaped = false
  local endPos = startPos + 1
  local bEnded = false
  local stringLen = string.len(s)
  repeat
    local curChar = string.sub(s,endPos,endPos)
    -- Character escaping is only used to escape the string delimiters
    if not escaped then
      if curChar==[[\]] then
        escaped = true
      else
        bEnded = curChar==startChar
      end
    else
      -- If we're escaped, we accept the current character come what may
      escaped = false
    end
    endPos = endPos + 1
    if not (endPos <= stringLen+1) then
       base.tracked_assert(endPos <= stringLen+1, "String decoding failed: unterminated string at position " .. endPos)
    end
  until bEnded
  local stringValue = 'return ' .. string.sub(s, startPos, endPos-1)
  local stringEval = base.loadstring(stringValue)
  if not (stringEval) then
     base.tracked_assert(stringEval, 'Failed to load string [ ' .. stringValue .. '] in JSON4Lua.decode_scanString at position ' .. startPos .. ' : ' .. endPos)
  end
  return stringEval(), endPos
end

--- Scans a JSON string skipping all whitespace from the current start position.
-- Returns the position of the first non-whitespace character, or nil if the whole end of string is reached.
-- @param s The string being scanned
-- @param startPos The starting position where we should begin removing whitespace.
-- @return int The first position where non-whitespace was encountered, or string.len(s)+1 if the end of string
-- was reached.
function decode_scanWhitespace(s,startPos)
  local whitespace=" \n\r\t"
  local stringLen = string.len(s)
  while ( string.find(whitespace, string.sub(s,startPos,startPos), 1, true)  and startPos <= stringLen) do
    startPos = startPos + 1
  end
  return startPos
end

--- Encodes a string to be JSON-compatible.
-- This just involves back-quoting inverted commas, back-quotes and newlines, I think ;-)
-- @param s The string to return as a JSON encoded (i.e. backquoted string)
-- @return The string appropriately escaped.
function encodeString(s)
  s = string.gsub(s,'\\','\\\\')
  s = string.gsub(s,'"','\\"')
  s = string.gsub(s,"'","\\'")
  s = string.gsub(s,'\n','\\n')
  s = string.gsub(s,'\t','\\t')
  s = string.gsub(s,'\r','\\r')
  return s
end

-- Determines whether the given Lua type is an array or a table / dictionary.
-- We consider any table an array if it has indexes 1..n for its n items, and no
-- other data in the table.
-- I think this method is currently a little 'flaky', but can't think of a good way around it yet...
-- @param t The table to evaluate as an array
-- @return boolean, number True if the table can be represented as an array, false otherwise. If true,
-- the second returned value is the maximum
-- number of indexed elements in the array.
function isArray(t)
  -- Next we count all the elements, ensuring that any non-indexed elements are not-encodable
  -- (with the possible exception of 'n')
  local maxIndex = 0
  for k,v in base.pairs(t) do
    if (base.type(k)=='number' and math.floor(k)==k and 1<=k) then	-- k,v is an indexed pair
      if (not isEncodable(v)) then return false end	-- All array elements must be encodable
      maxIndex = math.max(maxIndex,k)
    else
      if (k=='n') then
        if v ~= table.getn(t) then return false end  -- False if n does not hold the number of elements
      else -- Else of (k=='n')
        if isEncodable(v) then return false end
      end  -- End of (k~='n')
    end -- End of k,v not an indexed pair
  end  -- End of loop across all pairs
  return true, maxIndex
end

--- Determines whether the given Lua object / table / variable can be JSON encoded. The only
-- types that are JSON encodable are: string, boolean, number, nil, table and json.null.
-- In this implementation, all other types are ignored.
-- @param o The object to examine.
-- @return boolean True if the object should be JSON encoded, false if it should be ignored.
function isEncodable(o)
  local t = base.type(o)
  return (t=='string' or t=='boolean' or t=='number' or t=='nil' or t=='table') or (t=='function' and o==null)
end
