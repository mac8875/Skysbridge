import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const project = path.resolve('android/app/src/main/java');

async function findMainActivity(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = await findMainActivity(candidate);
      if (found) return found;
    } else if (entry.name === 'MainActivity.java') {
      return candidate;
    }
  }
  return null;
}

const activityPath = await findMainActivity(project);
if (!activityPath) throw new Error('Capacitor MainActivity.java was not generated');

let source = await readFile(activityPath, 'utf8');
if (source.includes('SkysbridgeNative')) {
  console.log('Android intro fullscreen bridge already installed');
  process.exit(0);
}

source = source.replace(
  'import com.getcapacitor.BridgeActivity;',
  'import android.view.View;\nimport android.webkit.JavascriptInterface;\nimport com.getcapacitor.BridgeActivity;'
);

const classOpen = 'public class MainActivity extends BridgeActivity {';
if (!source.includes(classOpen)) throw new Error('Unexpected Capacitor MainActivity template');

const bridge = `
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void setFullscreen(boolean enabled) {
                runOnUiThread(() -> getWindow().getDecorView().setSystemUiVisibility(
                    enabled
                        ? View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        : View.SYSTEM_UI_FLAG_VISIBLE
                ));
            }
        }, "SkysbridgeNative");
    }
`;

const closingBrace = source.lastIndexOf('}');
if (closingBrace < 0) throw new Error('MainActivity class has no closing brace');
source = source.slice(0, closingBrace) + bridge + source.slice(closingBrace);
await writeFile(activityPath, source);
console.log('Installed Android immersive mode for the intro sequence');
