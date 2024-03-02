p1 = "/Users/wzh/Downloads/beefalo_body-0.t.png" # trans
p2 = "/Users/wzh/Downloads/beefalo_body-0.p.png" # composite
p3 = "/Users/wzh/Downloads/beefalo_body-0.b.png" # trans bini

from PIL import Image

img1 = Image.open(p1)
img2 = Image.open(p2)
img3 = Image.open(p3)

pos = (43, 45)
def pprint(img):
	print()
	for y in range(img.width):
		for x in range(img.height):
			if 0 < img.getpixel((x,y))[3] < 255:
				print(x, y, img.getpixel((x,y)))

pprint(img1)
pprint(img2)
pprint(img3)
print(img1.getpixel(pos))
print(img2.getpixel(pos))
print(img3.getpixel(pos))