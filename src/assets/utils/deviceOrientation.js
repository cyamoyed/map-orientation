import {showConfirmDialog} from "vant";

let deviceorientation, deviceorientationabsolute;
export default function getDeviceOrientation(callback) {
    let gyroscopeAngle = 0
    let ua = navigator.userAgent.toLowerCase()
    if (window.DeviceOrientationEvent) {
        if (/android/.test(ua)) {
            deviceorientationabsolute = function (event) {
                let angle = event.webkitCompassHeading
                    ? event.webkitCompassHeading
                    : event.alpha
                if (angle >= 0) {
                    gyroscopeAngle = Number(angle)
                    callback(gyroscopeAngle)
                } else {
                    callback('获取陀螺仪角度失败')
                    removeDeviceOrientation()
                }
            }
            window.addEventListener('deviceorientationabsolute', deviceorientationabsolute)
        } else {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                showConfirmDialog({
                    title: '请求使用陀螺仪权限',
                    // message: '请求使用陀螺仪权限',
                }).then(() => {
                    window.DeviceOrientationEvent.requestPermission().then((state) => {
                        switch (state) {
                            case 'granted':
                                deviceorientation = function (event) {
                                    gyroscopeAngle = event.webkitCompassHeading
                                    callback(gyroscopeAngle)
                                };
                                window.addEventListener('deviceorientation', deviceorientation, false)
                                break
                            case 'denied':
                                callback('用户拒绝了使用陀螺仪')
                                removeDeviceOrientation()
                                break
                            case 'prompt':
                                callback('获取陀螺仪权限失败')
                                removeDeviceOrientation()
                                break
                        }
                    })
                })
                    .catch(() => {
                        // on cancel
                    });
            } else {
                deviceorientation = function (event) {
                    // iOS设备直接使用webkitCompassHeading
                    if (event.webkitCompassHeading) {
                        gyroscopeAngle = event.webkitCompassHeading
                        callback(gyroscopeAngle)
                    } else {
                        callback('获取陀螺仪角度失败')
                        removeDeviceOrientation()
                    }
                };
                // non iOS 13+
                window.addEventListener('deviceorientation', deviceorientation, true)
            }
        }
    }
}

function removeDeviceOrientation() {
    window.removeEventListener('deviceorientationabsolute', deviceorientationabsolute)
    window.removeEventListener('deviceorientation', deviceorientation)
}