title = "骑行"
description = "成为驯牛高手。"
version = 1

SetBank("wilsonbeefalo")
SetBuild("wilson")
PlayAnimation("walk_loop")
OverrideSymbol("swap_object", "swap_cane", "swap_cane")
OverrideSymbol("swap_hat", "flowerhat_crown", "swap_hat")
Hide("arm_normal")
AddOverrideBuild("beefalo_build")
OverrideSymbol("swap_saddle", "saddle_war", "swap_saddle")
OverrideSymbol("swap_body", "torso_amulets", "yellowamulet")


facing = 207

preview_scale = 0.5
bgc = "skyblue"