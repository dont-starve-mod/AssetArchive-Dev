import sys
import os
import subprocess
import argparse
import json
import time
import requests
import base64
from collections import Counter, namedtuple

''' fetch data from Don't Starve Wiki (https://dontstarve.huijiwiki.com/wiki/) '''

HOST = "http://dontstarve.huijiwiki.com"
WORKDIR = os.path.dirname(os.path.abspath(__file__)) + os.path.sep

def is_true(v):
    return v == "true" or v == True or v == 1

def query_all(start_from = 0):
    ''' get all data from server (debug only) '''
    
    raise RuntimeError("Debug only method, comment this line before using")
    try:
        result = json.load(open(WORKDIR + "wiki_data.json"))
        keys = set(result.keys())
    except:
        result = {}
        keys = set()

    for i in range(1000):
        if i < start_from:
            continue

        print(f"query page {i}")
        response = requests.get(HOST + "/api/rest_v1/namespace/data", params = {
            "pagesize": 1000,
            "page": i + 1,
        })
        data = response.json()
        if data["_returned"] == 0:
            break
        for item in data["_embedded"]:
            id = item["_id"]
            if result.get(id) and id not in keys:
                raise RuntimeError(f"duplicated id: {id}")
            else:
                result[id] = item

        json.dump(result, open(WORKDIR + "wiki_data.json", "w"), 
            indent = 2, ensure_ascii = False)

        time.sleep(1)

def query_all_regex(start_from = 0):
    result = json.load(open(WORKDIR + "wiki_data.json"))
    # keys = set(result.keys()) 
    
    for i in range(100):
        if i < start_from:
            continue

        print(f"query page {i}")
        response = requests.get(HOST + "/api/rest_v1/namespace/data", params = {
            "pagesize": 1000,
            "page": i + 1,
            "count": 1,
            "filter": json.dumps({
                "_id": { "$regex": r"^Data[:](?!DST_Strings|DS_Strings|ItemTranslation)" }
            })
        })
        data = response.json()
        if data["_returned"] == 0:
            break
        for item in data["_embedded"]:
            result[item["_id"]] = item

        json.dump(result, open(WORKDIR + "wiki_data.json", "w"), 
            indent = 2, ensure_ascii = False)

        time.sleep(1)

def query_all_categories():
    result = {}
    response = requests.get("https://dontstarve.huijiwiki.com/api.php?action=query&format=json&formatversion=2&list=allcategories&aclimit=400")
    # about 250 results got, if bigger than 500, use `accontinue`, see:
    # https://www.mediawiki.org/w/api.php?action=help&modules=query
    # https://www.mediawiki.org/wiki/API:Continue
    
    data = response.json()
    assert "continue" not in data
    names = [v["category"] for v in data["query"]["allcategories"]]

    for name in names:
        response = requests.get("http://dontstarve.huijiwiki.com/api.php?action=query&format=json&formatversion=2&list=categorymembers&" +
            "cmtitle=Category:{}&cmlimit=500".format(name))
        memberdata = response.json()
        if "continue" in memberdata:
            print("Warning: query need continue: ", name)

        result[name] = [v["title"] for v in memberdata["query"]["categorymembers"]]
        time.sleep(1)
        json.dump(result, open(WORKDIR + "allcategories.json", "w"),
            indent = 2, ensure_ascii = False)

    # important:
    # 自然生成物


def filter_all():
    data = json.load(open(WORKDIR + "wiki_data.json"))
    result = {}
    trans = {}
    def check_field(v, keys):
        return list(v.keys()) == ["_id", *keys]

    counter = Counter()

    for k,v in data.items():
        if k.startswith("Data:DST_Strings"):
            counter.update(["DST_Strings"]) # ignore loc
        elif k.startswith("Data:DS_Strings"):
            counter.update(["DS_Strings"]) # ignore loc
        elif k.startswith("Data:HomepageTrivia"):
            counter.update(["HomepageTrivia"]) # ignore trivia
        elif k.startswith("Data:ItemTranslation"):
            counter.update(["ItemTranslation"])
            trans[k] = v
        else:
            result[k] = v

    json.dump(result, open(WORKDIR + "wiki_data_filtered.json", "w"),
        indent = 2, ensure_ascii = False)

    result2 = {}
    for k,v in result.items():
        field = k.split(".")[0][5:]
        if field not in result2:
            result2[field] = {}

        result2[field][k] = v

    for k,v in result2.items():
        print(f"Field = {k}, NumItems = {len(v)}")
        json.dump(v, open(WORKDIR + k + ".json", "w"),
            indent = 2, ensure_ascii = False)

def refine_itemdata():
    data = json.load(open(WORKDIR + "ItemData.json"))
    result = {}

    unknown_keys = set()
    all_tags = set()
    for key,item in data.items():
        tags = set()
        for k, v in json.loads(item["json_data"]).items():
            match k:
                case "max_stack":
                    assert v > 0 
                    tags.add("stackable")
                case "floater":
                    assert is_true(v)
                    tags.add("floater")
                case "perishtime":
                    tags.add("perishable")
                case "waterproof":
                    if v > 0:
                        tags.add("waterproof")
                    elif v == 0:
                        tags.add("waterproof_container")
                    else:
                        raise ValueError(v)
                case "insulation_type":
                    if v == "winter":
                        tags.add("insulation_winter")
                    elif v == "summer":
                        tags.add("insulation_summer")
                    else:
                        raise ValueError(v)
                case "insulation_value" | "fuel_value" | "maxfuel":
                    assert v > 0
                case "absorbpercent":
                    assert v > 0
                    tags.add("damageabsorb") # armor + helmet
                case "finiteuses" | "planardamage" | "planardefense" | "maxcondition":
                    assert v > 0
                    tags.add(k)             
                case "healthvalue" | "sanityvalue" | "hungervalue" | "dapperness":
                    if v != 0:
                        tags.add(k+"_"+ (v > 0 and "positive" or "nagative"))
                case "damage":
                    # assert v > 0  # some weapons have damage = 0 (ice_staff, blowdart_fire, ...)
                    tags.add("weapon")
                case "foodtype" | "secondaryfoodtype":
                    tags.add("foodtype_"+v.lower())
                case "fuel_type" | "fueled_type":
                    tags.add(k.replace("_", "") + "_" + v.lower())
                case name:
                    unknown_keys.add(name)

        if tags:
            result[key] = {
                "_id": item["_id"],
                "code_name": item["code_name"],
                "tags": list(tags),
            }
            all_tags.update(tags)

    if unknown_keys:
        print("Warning: unknown keys", unknown_keys)

    json.dump(result, open(WORKDIR + "ItemData.Tag.json", "w"),
        indent = 2, ensure_ascii = False)

    print("AllTags: " + ", ".join(all_tags))

def refine_itemtable():
    data = json.load(open(WORKDIR + "ItemTable.json"))
    result = {}
    common_keys = set(["_id", "id", "display_name", "name_cn", "name_en", 
        "item_img1", "main_category", "version"])

    for k,v in data.items():
        prefab = v["id"]
        names = [v["display_name"], v["name_cn"], v["name_en"]]
        extra_keys = common_keys - set(v.keys())
        if extra_keys:
            raise RuntimeError(str(extra_keys))
        names = sorted(list(set(names)), key = names.index)
        result[v["_id"]] = {
            "_id": v["_id"],
            "prefab": prefab,
            "names": names,
        }

    json.dump(result, open(WORKDIR + "ItemString.json", "w"),
        indent = 2, ensure_ascii = False)

def refine_mobinfo():
    data = json.load(open(WORKDIR + "DSTMobInfo.json"))
    result = {}

    for k,v in data.items():
        assert v["main_category"] == "mob"
        for key, value in v.items():
            if key == "attitude":
                if value == "被动":
                    v[key] = "passive"
                elif value == "主动":
                    v[key] = "hostile"
                elif value == "中立":
                    v[key] = "neutral"
                else:
                    raise ValueError(value)
            elif is_true(value):
                v[key] = True

    json.dump(data, open(WORKDIR + "DSTMobInfo.Tag.json", "w"),
        indent = 2, ensure_ascii = False)

def final_step():
    # recent / history
    #   ...
    # item filter
    #   combat (weapon & armor)
    #   survive (hat & clothing)
    #   light
    #   recipe
    #   ------------
    #   food
    #   preparedfood
    #   
    #   ALL
    # mob filter
    #   neutral
    #   hostile
    #   passive
    #   epic
    #   -------
    #   ground
    #   cave
    #   ocean
    #   l_island
    #   ALL
    # image
    #   wallpaper (link#loading or list)
    #   bigportrait (filter)
    #   inventory (entry or filter)
    #   minimap (link#minimap_data)
    #   book (entry or filter)
    #   ui (list)
    #   
    # character_animation
    #   wilson [link]
    #   wilsonbeefalo [link]
    # sfx
    #   music (list)
    #   player voice (filter)
    #   amb  (list)
    #   ALL  (link#.fev)
    # random
    #   animzip bank image colorcube 
    #   sound shader  ANY
    
    mob_filter = {}
    item_filter = {}

    def load(file):
        return json.load(open(WORKDIR + file))

    # mob
    Mob = namedtuple("Mob", "name_cn, name_en, wiki_title")
    all_tags = set()
    for k,v in load("DSTMobInfo.Tag.json").items():
        mob = Mob(v["name_cn"], v["name_en"], v["title"])
        tags = []
        for tag in (
            ("surface",),
            ("cave",),
            ("ocean",),
            ("l_island",),
            ("tag_epic",),
            ("tag_monster",),
            ("tag_animal",),
            ("tag_flying",),
            ("tag_lunar_aligned",),
            ("tag_shadow_aligned",),
            ("follower",),
            ("planarentity",),
            ("sanity", "sanityaura"),
            ("item", "inventoryitem"),
        ):
            key2 = len(tag) > 1 and tag[1] or tag[0]
            key1 = tag[0]
            if v[key1]:
                tags.append(key2)

        match v["attitude"]:
            case "hostile":
                tags.append("attitude_hostile")
            case "passive":
                tags.append("attitude_passive")
            case "neutral":
                tags.append("attitude_neutral")
            case name:
                raise RuntimeError("Invalid attitude: "+ name)

        # hostile - noTag: 高脚鸟, 钢羊, 蚊子
        # not hostile - Tag: 树精守卫, 坎普斯
        mob_filter[mob] = tags
        all_tags.update(tags)
    
    # print("\n".join(sorted(all_tags)))

    # item
    Item = namedtuple("Item", "prefab, tags")
    for k,v in load("ItemData.Tag.json").items():
        item = Item(v["code_name"], v["tags"])
        item_filter[item.prefab] = v["tags"]

    print(item_filter)

        




if __name__ == '__main__':
    parser = argparse.ArgumentParser(description = "CLI tool for fetching excellent data from Don't Starve Wiki")
    # parser.add_argument("--windows-ip", "-p", type = int, default = 0, help = "last int number of windows VM ip")
    # parser.add_argument("--cookie", type = str, help = "cookie to login LanZouCloud")
    # parser.add_argument("--compile-target", "-c", type = str, default = "all", help = "set compile target: mac/win")
    # parser.add_argument("--upload", "-u", action = "store_true", help = "upload installer to web")
    # parser.add_argument("--fetch", action = "store_true", help = "upgrade installer from windows")
    final_step()