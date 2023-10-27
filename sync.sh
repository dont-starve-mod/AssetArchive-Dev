desktop="/Volumes/[C] Windows 11-dev.hidden/Users/wzh/Desktop"
workdir=${desktop}/AssetArchiveWin/

rsync -a --exclude-from rsync_exclude.txt ./ "${workdir}"
