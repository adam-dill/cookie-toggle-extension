# Cookie Toggle Extension

This Chrome extension lets you define cookie names and enabled/disabled values, then toggle those cookies for the current website from the extension popup.

## Install the extension from the files

1. Download or clone this repository to your computer.
2. Open Google Chrome and go to chrome://extensions.
3. Turn on Developer mode in the top-right corner.
4. Click Load unpacked.
5. Select the src folder from this project.
6. The Cookie Toggle extension should appear in your list of installed extensions and in the toolbar.

## Use the extension

1. Open a website in Chrome where you want to manage cookies.
2. Click the Cookie Toggle icon in the toolbar.
3. Open the Manage section in the popup.
4. Click Add cookie and enter:
   - Cookie name
   - Enabled value
   - Disabled value
   - Optional: enable Delete on disable if you want the cookie removed instead of set to the disabled value
5. Click Save config.
6. Click Toggle to switch the configured cookies between the enabled and disabled values.
7. The extension badge will show ON or OFF based on the current state of the configured cookies.
