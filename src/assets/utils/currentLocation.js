export function getCurrentLocation(successFunc, errorFunc) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (position) {
        if (typeof successFunc != "undefined") {
          successFunc({
            longitude: position.coords.longitude,
            latitude: position.coords.latitude
          })
        }
      },
      function (e) {
        switch (e.code) {
          case 1:
            console.log("位置服务被拒绝。");
            break;
          case 2:
            console.log("暂时获取不到位置信息。");
            break;
          case 3:
            console.log("获取位置信息超时。");
            break;
          default:
            console.log("未知错误。");
            break;
        }
        if (typeof errorFunc != "undefined") {
          errorFunc(e.code + e.message)
        }
        throw(e.message);
      }, {
        timeout: 5000,
        enableHighAccuracy: true
      }
    )
  } else {
    alert("你的浏览器不支持获取地理位置信息。");
    if (typeof errorFunc != "undefined") {
      errorFunc("你的浏览器不支持获取地理位置信息。");
    }
  }
}
