import smallhash from "../../smallhash"

export type Preset = {
  key: string,
  title: string,
  cmds: ({name: string, args: any[]})[],
}

type ConditionId = "and" | "or" | "true" | "false" | "bankis" 

export type PresetCondition = [ConditionId, ...Array<string | any[/* as child PresetCondition */]>]

export type DefinedPresetGroup = {
  key: string,
  title: string,
  order: number,
  condition: PresetCondition,
  presets: Preset[],
  presets_configable?: true,
}

export function checkCondition(condition: PresetCondition, data: any): boolean  {
  const stack = [condition] as any[]
  const valueBuffer = []
  while (stack.length > 0) {
    const v = stack.pop()
    const id = v[0].toLowerCase() as ConditionId
    const args = v.slice(1)
    switch (id) {
      case "and":
      case "or":
        valueBuffer.push(id)
        args.forEach(v=> {if (Array.isArray(v)) stack.push(v)})
        break
      case "true":
      case "false":
        valueBuffer.push(id === "true")
        break
      case "bankis":
        let match = false
        args.forEach(bank=> {
          if (typeof bank === "string" && data.bank !== undefined 
            && smallhash(bank) === smallhash(data.bank)) {
              match = true
            }
        })
        valueBuffer.push(match)
        break
    }
  }
  // console.log(valueBuffer)
  let values = []
  while (valueBuffer.length > 0) {
    const v = valueBuffer.pop()
    if (v === "and") {
      if (values.length === 0) throw Error("Error value buffer: `and` at end")
      values = [values.every(v=> v)]
    }
    else if (v === "or") {
      if (values.length === 0) throw Error("Error value buffer: `or` at end")
      values = [values.find(v=> v) !== undefined]
    }
    else {
      values.push(v)
    }
  }
  if (values.length !== 1) throw Error("Error value buffer: size not 1")
  return values.pop()
}

// function test() {
//   console.log("TEST")
//   console.log(checkCondition(["or", ["BankIs", "aaa", "bbb"], ["BankIs", "ccc"]], {bank: "aaa"}), true)
//   console.log(checkCondition(["or", ["BankIs", "aaa", "bbb"], ["BankIs", "ccc"]], {bank: "ccc"}), true)
//   console.log(checkCondition(["or", ["BankIs", "aaa", "bbb"], ["BankIs", "ccc"]], {bank: "bbb"}), true)
//   console.log(checkCondition(["or", ["BankIs", "aaa", "bbb"], ["BankIs", "ccc"]], {bank: "ddd"}), false)
//   console.log(checkCondition(["and", ["BankIs", "aaa", "bbb"], ["BankIs", "ccc"]], {bank: "aaa"}), false)
// }

// test()