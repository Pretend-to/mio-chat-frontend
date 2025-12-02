export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

export function shareOrCopy(url) {
  let result = false;
  let message = "";
  if (navigator.share) {
    result = true;
    message = "分享成功";

    navigator
      .share({
        title: "从Mio Chat分享",
        url: url,
      })
      .then(() => {
        console.log("Successful share");
      })
      .catch((error) =>{
        console.error("Error sharing:", error);
        result = false;
        message = "分享失败";
      });
  } else if (navigator.clipboard) {
    result = true;
    message = "链接已复制到剪贴板";
    navigator.clipboard
      .writeText(url)
      .then(() => {
        console.log("URL copied to clipboard");
      })
      .catch((err) => {
        console.error("Could not copy text: ", err);
        result = false;
        message = "复制失败";
      });
  } else {
    console.warn("Share and Clipboard APIs are not supported in this browser.");
  }
  return {
    success: result,
    message: message,
  };
}