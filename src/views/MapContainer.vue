<template>
  <div>
    <div class="compass-btn" @click="setRotationToNorth">
      <canvas ref="compass" id="compass" width="200" height="200" style="position: relative;left: -82px;top: -82px;"></canvas>
    </div>
    <div class="layer-btn" @click="showLayerPopup">
      <van-icon class="points-icon" name="list-switching"/>
    </div>
    <div class="info-btn" @click="showInfoPopup">
      <van-icon name="info-o"/>
    </div>
    <div class="traffic-btn" @click="toggleTraffic" :class="chosenTraffic ? 'chosen-traffic' : ''">
      <van-icon name="more-o"/>
    </div>
    <div class="road-btn" @click="toggleRoad" :class="chosenRoad ? 'chosen-road' : ''">
      <van-icon name="miniprogram-o"/>
    </div>
    <div class="location-btn" @click="locatePosition">
      <van-icon name="aim" v-if="!isLocating"/>
      <van-loading type="spinner" size="20px" v-else/>
    </div>
    <div class="app-container">
      <div style="background-color: #ffffff;">
        <div id="container"></div>
      </div>
    </div>
    <van-popup v-model:show="layerShow" position="bottom" :style="{ height: '20%', padding: '10px' }"
               class='layer_popup'>
      <van-row gutter="20">
        <van-col span="12" @click="toggleLayer('standard')" :class="chosenLayer === 'standard' ? 'chosenLayer' : ''">
          <div class="layer-switch-btn">
            <div class="layer-img standard-img">
            </div>
            <div class="text">标准地图</div>
          </div>
        </van-col>
        <van-col span="12" @click="toggleLayer('satellite')" :class="chosenLayer === 'satellite' ? 'chosenLayer' : ''">
          <div class="layer-switch-btn">
            <div class="layer-img satellite-img">
            </div>
            <div class="text">卫星地图</div>
          </div>
        </van-col>
      </van-row>
    </van-popup>
    <van-popup v-model:show="infoShow" position="bottom" :style="{ height: '40%', padding: '10px' }" class='info_popup'>
      <van-cell-group title="当前坐标">
        <van-cell center title="WGS84" icon="location-o" :label="wgs84CurrentPosition"
                  @click="copyPosition(wgs84CurrentPosition)">
          <!-- 使用 right-icon 插槽来自定义右侧图标 -->
          <template #right-icon>
            <van-icon name="description-o"/>
          </template>
        </van-cell>
        <van-cell center title="GCJ02" icon="location-o" :label="gcj02CurrentPosition"
                  @click="copyPosition(gcj02CurrentPosition)">
          <!-- 使用 right-icon 插槽来自定义右侧图标 -->
          <template #right-icon>
            <van-icon name="description-o"/>
          </template>
        </van-cell>
        <van-cell center title="BD09" icon="location-o" :label="bd09CurrentPosition"
                  @click="copyPosition(bd09CurrentPosition)">
          <!-- 使用 right-icon 插槽来自定义右侧图标 -->
          <template #right-icon>
            <van-icon name="description-o"/>
          </template>
        </van-cell>
      </van-cell-group>
    </van-popup>
  </div>
</template>

<script setup>
import AMapLoader from '@amap/amap-jsapi-loader';
/*在Vue3中使用时,需要引入Vue3中的shallowRef方法(使用shallowRef进行非深度监听,
因为在Vue3中所使用的Proxy拦截操作会改变JSAPI原生对象,所以此处需要区别Vue2使用方式对地图对象进行非深度监听,
否则会出现问题,建议JSAPI相关对象采用非响应式的普通对象来存储)*/
import {onMounted, onUnmounted, ref} from "vue";
import {gcj02tobd09, wgs84togcj02} from "../assets/utils/transformCoordinate";
import getDeviceOrientation from "../assets/utils/deviceOrientation";
import {getCurrentLocation} from "../assets/utils/currentLocation";
import useClipboard from 'vue-clipboard3'
import {showNotify} from "vant";

const {toClipboard} = useClipboard()

let map = null;
let AMap = null;
let circleMarker;
// 持续定位事件
let getLocationTimer = null;
// 是否正在定位
let isLocating = ref(false);
// 是否显示图层弹窗
const layerShow = ref(false);
// 是否显示信息弹窗
const infoShow = ref(false);
// 是否选择图层
const chosenLayer = ref('standard');
// 当前位置坐标
let wgs84CurrentPosition = ref(''), gcj02CurrentPosition = ref(''), bd09CurrentPosition = ref('');

// 当前位置图标
let canvas;
// 当前位置坐标
let currentPosGcj02 = null;

// 卫星图层
let satellite;
// 实时路况图层
let trafficLayer;
// 路网图层
let roadLayer;
// 是否选择实时路况
let chosenTraffic = ref(false);
// 是否选择路网
let chosenRoad = ref(false);

// 指南针
const compass = ref();

/**
 * 复制坐标
 * @param position
 */
const copyPosition = (position) => {
  position = position.replace(' ', '').trim();
  toClipboard(position).then(() => {
    // 成功通知
    showNotify({type: 'success', message: '复制成功'});
  }).catch(() => {
    showNotify({type: 'danger', message: '复制失败'});
  })
}

/**
 * 显示图层弹窗
 */
const showLayerPopup = () => {
  layerShow.value = true;
};

/**
 * 显示信息弹窗
 */
const showInfoPopup = () => {
  infoShow.value = true;
};

/**
 * 开关实时路况
 */
const toggleTraffic = () => {
  if (!trafficLayer.getVisible()) {
    trafficLayer.show();
    chosenTraffic.value = true;
  } else {
    trafficLayer.hide();
    chosenTraffic.value = false;
  }
};

/**
 * 开关路网
 */
const toggleRoad = () => {
  if (!roadLayer.getVisible()) {
    roadLayer.show();
    chosenRoad.value = true;
  } else {
    roadLayer.hide();
    chosenRoad.value = false;
  }
};

/**
 * 切换地图图层
 * @param type
 */
const toggleLayer = (type) => {
  chosenLayer.value = type;
  if (type === 'standard') {
    map.remove(satellite)
  } else {
    map.addLayer(satellite);
  }
  layerShow.value = false;
};

/**
 * 初始化地图
 */
function initMap() {
  window._AMapSecurityConfig = {
    securityJsCode: '629c89a4442fa69cdfc8fa240aff8fbf',
  }
  AMapLoader.load({
    key: "8219a852e508e5cfe0a047f136192a3c", // 申请好的Web端开发者Key，首次调用 load 时必填
    version: "2.0", // 指定要加载的 JSAPI 的版本，缺省时默认为 1.4.15
    plugins: ['AMap.Scale', 'AMap.ControlBar'], // 需要使用的的插件列表，如比例尺'AMap.Scale'等
    AMapUI: {
      //是否加载 AMapUI，缺省不加载
      version: "1.1", //AMapUI 版本
      plugins: ["overlay/SimpleMarker"], //需要加载的 AMapUI ui 插件
    },
    Loca: {
      //是否加载 Loca， 缺省不加载
      version: "2.0", //Loca 版本
    },
  }).then((aMap) => {
    AMap = aMap;
    map = new AMap.Map("container", {  //设置地图容器id
      viewMode: "3D",    //是否为3D地图模式
      zoom: 13,           //初始化地图级别
      center: [106.550483, 29.563707], //初始化地图中心点位置
    });
    //实时路况图层
    trafficLayer = new AMap.TileLayer.Traffic({
      zIndex: 10,
      zooms: [7, 22],
    });
    trafficLayer.hide();
    trafficLayer.setMap(map);

    // 路网
    roadLayer = new AMap.TileLayer.RoadNet();
    roadLayer.hide();
    roadLayer.setMap(map);

    map.addControl(new AMap.Scale()); //添加比例尺组件到地图实例上
    satellite = new AMap.TileLayer.Satellite();

    map.on('complete', function () {
      //地图图块加载完成后触发
      getLocation().then((pos) => {
        map.setCenter([pos.longitude, pos.latitude]); //设置地图中心点
      });
      drawCompass();
    });

    // 持续定位
    getLocationTimer = setInterval(() => {
      getLocation();
    }, 3000);

    // 监听地图移动事件
    map.on('mapmove', () => {
      updateCurrentPos();
      rotateCompass(map.getRotation())
    });

    // 监听地图拖拽事件
    map.on('dragging', () => {
      rotateCompass(map.getRotation())
    });

    // 监听设备方向变化
    getDeviceOrientation((degrees) => {
      if (typeof degrees === 'string') {
        // alert(degrees)
      }
      // 旋转位置图标
      rotateCanvas(degrees)
    })
  }).catch(e => {
    console.log(e);
  })
}

/**
 * 更新当前位置信息
 * @param position
 */
function updatePositionInfo(position) {
  wgs84CurrentPosition = `${position.longitude.toFixed(6)}, ${position.latitude.toFixed(6)}`;
  gcj02CurrentPosition = `${currentPosGcj02.longitude.toFixed(6)}, ${currentPosGcj02.latitude.toFixed(6)}`;
  let bd09Position = gcj02tobd09(currentPosGcj02.longitude, currentPosGcj02.latitude);
  bd09CurrentPosition = `${bd09Position[0].toFixed(6)}, ${bd09Position[1].toFixed(6)}`;
}

/**
 * 获取当前位置
 * @returns {Promise<unknown>}
 */
function getLocation() {
  // let pos = {
  //   longitude: 106.546853,
  //   latitude: 29.566289
  // }
  return new Promise((resolve, reject) => {
    getCurrentLocation((pos) => {
      let lng = pos.longitude;
      let lat = pos.latitude;
      const position = wgs84togcj02(lng, lat);
      currentPosGcj02 = {
        longitude: position[0],
        latitude: position[1]
      }
      if (!canvas) {
        canvas = createPointCanvas();
        document.body.append(canvas);
      }
      updateCurrentPos();
      updatePositionInfo(pos);
      resolve(currentPosGcj02);
    }, (err) => {
      console.log(err)
      reject(err);
    })
  })
}

/**
 * 定位到当前位置
 */
function locatePosition() {
  isLocating.value = true;
  getLocation().then((pos) => {
    const zoom = map.getZoom();
    const sZoom = zoom < 17 ? 17 : zoom;
    map.setRotation(0, true);
    map.setZoomAndCenter(sZoom, [pos.longitude, pos.latitude]);
    setTimeout(() => {
      isLocating.value = false;
    }, 500);
  });
}

/**
 * 更新当前位置图标
 */
function updateCurrentPos() {
  if (!currentPosGcj02) return;
  circleMarker && circleMarker.setMap(null);
  circleMarker = new AMap.CircleMarker({
    center: new AMap.LngLat(currentPosGcj02.longitude, currentPosGcj02.latitude),
    radius: 10,//3D视图下，CircleMarker半径不要超过64px
    strokeColor: 'white',
    strokeWeight: 4,
    strokeOpacity: .8,
    fillColor: 'rgb(0,149,255)',
    fillOpacity: .8,
    zIndex: 10,
    bubble: true,
    cursor: 'pointer',
    clickable: true
  })
  // circleMarker.setMap(map);
  let pixel = lnglat2container(`${currentPosGcj02.longitude}, ${currentPosGcj02.latitude}`);
  // 设置canvas屏幕坐标，要计算transformOrigin的偏移量
  let x = pixel.x - (canvas.width / 2);
  let y = pixel.y - (canvas.height / 2) - canvas.height * 0.2;
  canvas.style.left = x + 'px';
  canvas.style.top = y + 'px';
}

/**
 * 设置地图旋转角度为正北方向
 */
function setRotationToNorth() {
  map.setRotation(0);
  rotateCompass(0);
}

/**
 * 经纬度坐标转成容器像素坐标
 * @param lnglatInput
 * @returns {*}
 */
function lnglat2container(lnglatInput) {
  if (!lnglatInput) return
  const inputVal = lnglatInput.split(',');
  const lnglat = new AMap.LngLat(inputVal[0], inputVal[1]);
  const pixel = map.lngLatToContainer(lnglat);
  return pixel.round();
}

function drawCompass() {
  const canvas = compass.value;
  console.log(canvas)
  const ctx = canvas.getContext('2d');

  // 设置线条颜色和宽度
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 5;

  // 开始绘制
  ctx.beginPath();
  ctx.moveTo(100, 50);   // 顶点
  ctx.lineTo(60, 150);   // 左下角
  ctx.lineTo(100, 120);   // 左燕尾
  ctx.lineTo(100, 120);  // 右燕尾
  ctx.lineTo(140, 150);  // 右下角
  ctx.closePath();       // 闭合路径
  ctx.stroke();          // 描边路径
}

/**
 * 旋转指南针
 * @param compassRotate
 */
function rotateCompass(compassRotate) {
  // compassRotate -= 46;
  compass.value.style.transform = `scale(0.2) rotate(${compassRotate}deg)`;
}

/**
 * 创建当前位置图标
 * @returns {HTMLCanvasElement}
 */
function createPointCanvas() {
  const canvas = document.createElement('canvas');
  canvas.id = 'pointCanvas';
  canvas.height = 140;
  canvas.width = 120;
  const ctx = canvas.getContext('2d');

  // 计算圆心位置，使整个图标居中
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 + 25; // 将圆心稍微下移，以便三角形顶点在-50位置

  // 绘制蓝色三角形，顶点稍微降低
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - 80); // 顶点稍微降低
  ctx.lineTo(centerX - 38, centerY); // 左下角与圆的边缘重合
  ctx.lineTo(centerX + 38, centerY); // 右下角与圆的边缘重合
  ctx.closePath();
  ctx.fillStyle = '#007BFF'; // 蓝色
  ctx.fill();

  // 给三角形添加白色轮廓
  ctx.strokeStyle = 'white'; // 设置轮廓颜色为白色
  ctx.lineWidth = 5; // 设置轮廓线宽度
  ctx.stroke(); // 应用轮廓

  // 绘制蓝色圆形
  ctx.beginPath();
  ctx.arc(centerX, centerY, 40, 0, 2 * Math.PI);
  ctx.fillStyle = '#007BFF'; // 蓝色
  ctx.fill();

  // 给圆形添加白色轮廓
  ctx.strokeStyle = 'white'; // 设置轮廓颜色为白色
  ctx.lineWidth = 5; // 设置轮廓线宽度
  ctx.stroke(); // 应用轮廓
  return canvas;
}

/**
 * 旋转Canvas
 * @param degrees
 */
function rotateCanvas(degrees) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 + 25;
  const originX = centerX / canvas.width * 100; // 计算中心点相对于Canvas宽度的百分比
  const originY = centerY / canvas.height * 100; // 计算中心点相对于Canvas高度的百分比
  canvas.style.transformOrigin = `${originX}% ${originY}%`; // 设置transform-origin为中心点的百分比值
  canvas.style.transform = `scale(0.2) rotate(${degrees}deg)`;
}

onMounted(() => {
  initMap();
});
onUnmounted(() => {
  map?.destroy();
  map = null;
  canvas?.remove();
});

</script>

<style lang="scss" scoped>
#container {
  padding: 0;
  margin: 0;
  width: 100%;
  height: 100vh;
}

.compass-btn {
  position: fixed;
  top: 30px;
  left: 20px;
  z-index: 999;
  font-size: 19px;
  text-align: center;
  color: black;
  border-radius: 10px;
  background-color: white;
  line-height: 40px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  -webkit-text-size-adjust: none;

  .compass {
    transform: rotate(314deg);
  }
}

.layer-btn {
  position: fixed;
  top: 30px;
  right: 20px;
  z-index: 999;
  font-size: 19px;
  text-align: center;
  color: black;
  border-radius: 10px;
  background-color: white;
  line-height: 37px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  -webkit-text-size-adjust: none;
}

.info-btn {
  position: fixed;
  top: 75px;
  right: 20px;
  z-index: 999;
  font-size: 19px;
  text-align: center;
  color: black;
  border-radius: 10px;
  background-color: white;
  line-height: 37px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  -webkit-text-size-adjust: none;
}

.traffic-btn {
  position: fixed;
  top: 120px;
  right: 20px;
  z-index: 999;
  font-size: 19px;
  text-align: center;
  color: black;
  border-radius: 10px;
  background-color: white;
  line-height: 37px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  -webkit-text-size-adjust: none;
}

.chosen-traffic {
  background-color: #27ab6a;
  color: white;
}

.road-btn {
  position: fixed;
  top: 165px;
  right: 20px;
  z-index: 999;
  font-size: 19px;
  text-align: center;
  color: black;
  border-radius: 10px;
  background-color: white;
  line-height: 37px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  -webkit-text-size-adjust: none;
}

.chosen-road {
  background-color: #e3b132;
  color: white;
}

.location-btn {
  position: fixed;
  bottom: 30px;
  right: 20px;
  z-index: 999;
  font-size: 19px;
  text-align: center;
  background-color: #FFFFFF;
  color: black;
  border-radius: 10px;
  line-height: 37px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  -webkit-text-size-adjust: none;
}

.layer_popup {
  text-align: center;

  .layer-switch-btn {
    margin-top: 10px;

    .layer-img {
      cursor: pointer;
      width: 86px;
      height: 60px;
      margin: 0 auto;
      border-radius: 10px;
      background-image: url('../assets/img/maptype.png');
      background-position: 0 0;
      background-size: 86px 240px;
    }

    .standard-img {
      background-position: 0 0;
    }

    .satellite-img {
      background-position: 0 -60px;
    }
  }

  .chosenLayer {
    .layer-img {
      border: 2px solid #007BFF;
    }

    .text {
      color: #007BFF;
    }
  }
}

.info_popup {

}
</style>
<style>
#pointCanvas {
  position: absolute;
  width: 120px;
  height: 140px;
  top: 0;
  left: 0;
  z-index: 1000;
//transition: transform 0.5s; transform: scale(0.2);
  transform-origin: 50% 62.5%;
  pointer-events: none;
  background-color: transparent;
  cursor: pointer;
}
</style>