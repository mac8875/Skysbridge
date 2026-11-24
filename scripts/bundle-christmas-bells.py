"""Bundle CC0 rhythmic sleigh bells locally, without a visitor-side third-party request."""
import html, re, urllib.request, pathlib, sys
target=pathlib.Path("assets/christmas-sleigh-bells-rhythm.mp3")
target.parent.mkdir(parents=True,exist_ok=True)
if target.exists() and target.stat().st_size>10000:
    sys.exit(0)
pages=[
    "https://freesound.org/people/soundstack/sounds/255104/",
    "https://freesound.org/s/255104/",
    "https://freesound.org/embed/sound/iframe/255104/simple/medium/"
]
def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Skysbridge/1.0 (https://skysbridge.org; CC0 audio asset)","Accept":"*/*"})
    with urllib.request.urlopen(req,timeout=12) as r:
        return r.read(15*1024*1024)
# Prefer an authentic recorded harness-bell loop. SFX Jar lists it as CC0.
try:
    data=fetch("https://audio.sfxjar.com/audio/0585.mp3")
    if len(data)>10000 and (data[:3]==b"ID3" or (data[0]==255 and data[1]&224==224)):
        target.write_bytes(data)
        print("Bundled CC0 BigSoundBank sleigh bells from SFX Jar:",len(data),"bytes")
        sys.exit(0)
except Exception as error:
    print("SFX Jar bell source unavailable:",error)

for page in pages:
    try:
        source=html.unescape(fetch(page).decode("utf-8","replace")).replace("\\/","/")
        matches=re.findall(r'(?:https:)?//(?:cdn\.)?freesound\.org/previews/255/255104_[0-9]+-(?:hq|lq)\.mp3',source)
        for url in sorted(set(matches),key=lambda x: "-hq" not in x):
            data=fetch(url if url.startswith("https:") else "https:"+url)
            if len(data)>10000 and (data[:3]==b"ID3" or (data[0]==255 and data[1]&224==224)):
                target.write_bytes(data)
                print("Bundled CC0 soundstack sleigh bells:",len(data),"bytes")
                sys.exit(0)
    except Exception as error:
        print("Sleigh bell source unavailable:",error)
print("WARNING: recorded bell audio unavailable; Christmas page remains functional and silent.",file=sys.stderr)
