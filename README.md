# My Harbor / Compass Scripts
My scripts for the Harbor Stremio client (or the new fork [Compass](https://github.com/compassstremio/Compass) after Harbor Team announced the sunset of Harbor) for personal use

### harbor.js / compass.js
> [!TIP]
> Use the script corresponding to the client you use, Compass uses libmpv for streaming, which changed up a few internal calls but both scripts accomplish the same things. Paste it into the Custom JS section in the app settings, you do not need to restart the app.

The script does 4 things to the player in Harbor or Compass - 
1. It makes mouse right clicks simple play or pause only, no context menu
2. It removes play pause functionality from the left click but retains default double click to full-screen and click to drag functionality
3. It lets you configure and use a keyboard shortcut (Ctrl + Shift + M by default) to use the context menu if needed
4. Makes Shift + Left/Right -0.5s/+0.5s seek respectively by default, duration can be changed
