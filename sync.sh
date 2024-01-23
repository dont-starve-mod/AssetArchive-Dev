desktop="/Volumes/[C] Windows 11-dev-new/Users/wzh/Desktop"
workdir=${desktop}/AssetArchiveWin/

rsync -a --exclude-from rsync_exclude.txt ./ "${workdir}"
