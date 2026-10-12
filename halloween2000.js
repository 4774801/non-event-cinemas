(() => {
  // HALLOWEEN ROUND DEPLOY SYNC
  const SKELTAL = "https://i.kym-cdn.com/photos/images/newsfeed/002/728/839/2ef.gif";

  function addCorner(side) {
    const img = document.createElement("img");
    img.src = SKELTAL;
    img.alt = "Mr Skeltal trumpet skeleton";
    img.className = `haunted-corner ${side}`;
    document.body.appendChild(img);
  }

  function addDoot(left, delay) {
    const el = document.createElement("div");
    el.className = "doot-floater";
    el.textContent = "☠ DOOT DOOT ☠";
    el.style.left = left;
    el.style.animationDelay = delay;
    document.body.appendChild(el);
  }

  function init() {
    addCorner("left");
    addCorner("right");
    addDoot("13%", "-2s");
    addDoot("74%", "-5s");
    addDoot("46%", "-7s");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();