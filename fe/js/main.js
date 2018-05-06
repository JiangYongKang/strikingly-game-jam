import Player from './player/index'
import Obstacle from './element/obstacle'
import Godman from './npc/godman'
import Badman from './npc/badman'

import Glow from './npc/glow'

import BackGround from './runtime/background'
import GameInfo from './runtime/gameinfo'
import Music from './runtime/music'
import DataBus from './databus'
import Lifebar from './element/lifebar'
import { STATE } from './databus'
import { calcShootingIntervalFrames } from './utils/difficulty'
import {
  MAX_LIFE,
  screenHeight,
  INCREMENT_WHEN_HIT_FRIEND_ZONED_CARD,
  INCREMENT_WHEN_HIT_GOD_MAN,
} from './config/index'
import ExecuteOnceWrapper from './utils/executeOnceWrapper'

const GLOW_SHOW_SCORE = 5
let glowShowCount = 0
let glowShowTime = 2000

let life = MAX_LIFE
let ctx = canvas.getContext('2d')
let databus = new DataBus()

/**
 * 游戏主函数
 */
export default class Main {
  constructor() {

    // TODO: 请不要修改 login 的代码，包括 console.log
    wx.login({
      success: function(res) {
        console.log('code = ' + res.code)
        console.log('code = ' + res.code)
        wx.getUserInfo({
          success: function(resp) {
            wx.request({
              method: 'POST',
              url: 'https://strikingly-game-jam.herokuapp.com/wechat_users',
              data: {
                code: res.code,
                nickname: resp.userInfo.nickName,
                picture: resp.userInfo.avatarUrl,
              },
              success: function(res) {
                console.log('登录成功!')
                console.log(res)
                GameGlobal.user_info = {
                  id: res.data.wechat_user.id,
                  open_id: res.data.wechat_user.open_id
                }
              }
            })
          }
        })
      }
    })

    // 维护当前requestAnimationFrame的id
    this.aniId = 0
    this.runGame()
  }

  runGame() {
    databus.reset()

    canvas.removeEventListener(
      'touchstart',
      this.touchHandler
    )

    this.bg = new BackGround(ctx)
    this.player = new Player(ctx)
    this.godman = new Godman(ctx)
    this.glow = new Glow(this.godman)
    this.gameinfo = new GameInfo()
    this.music = new Music()

    this.bindLoop = this.loop.bind(this)
    this.hasEventBind = false

    databus.state = STATE.BEGIN

    // 清除上一局的动画
    window.cancelAnimationFrame(this.aniId);

    this.aniId = window.requestAnimationFrame(
      this.bindLoop,
      canvas
    )

    this.life = MAX_LIFE
    this.lifebar = new Lifebar(ctx, this.life)
    this.executeOnceWrapper = new ExecuteOnceWrapper()
  }

  restart() {
    glowShowCount = 0
    glowShowTime = 0
    databus.reset()
    databus.state = STATE.RUN
    canvas.removeEventListener(
      'touchstart',
      this.touchHandler
    )

    this.bg = new BackGround(ctx)
    this.player = new Player(ctx)
    this.godman = new Godman(ctx)
    this.glow = new Glow(this.godman)
    this.gameinfo = new GameInfo()
    this.music = new Music()

    this.bindLoop = this.loop.bind(this)
    this.hasEventBind = false

    // 清除上一局的动画
    window.cancelAnimationFrame(this.aniId);

    this.aniId = window.requestAnimationFrame(
      this.bindLoop,
      canvas
    )

    this.life = MAX_LIFE
    this.lifebar = new Lifebar(ctx, this.life)

    this.clearBadman()
    this.executeOnceWrapper.reset()
  }

  setupBadman() {
    this.badman = new Badman(ctx)
    this.badman.y = screenHeight + 80
    this.badminAppearIntervalID = setInterval(() => {
      if (this.badman.y > screenHeight - 70) {
        this.badman.y -= 1.5
      }
    }, 1000/60);
  }

  clearBadman() {
    this.badman = null
    clearInterval(this.badminAppearIntervalID)
  }

  /**
   * 随着帧数变化的敌机生成逻辑
   * 帧数取模定义成生成的频率
   */
  obstacleGenerate() {
    // TODO: FIXME
    if (databus.frame % 100 === 0) {
      let obstacle = databus.pool.getItemByClass('obstacle', Obstacle)
      obstacle.init(3)
      databus.obstacles.push(obstacle)
    }
  }
  // 全局碰撞检测
  collisionDetection() {
    let that = this

    databus.loveBullets.forEach((bullet) => {
      for (let i = 0, il = databus.obstacles.length; i < il; i++) {
        let obstacle = databus.obstacles[i]

        if (!obstacle.isPlaying && obstacle.isCollideWith(bullet)) {
          obstacle.playAnimation()
          that.music.playExplosion()

          bullet.visible = false
          databus.score += INCREMENT_WHEN_HIT_FRIEND_ZONED_CARD
          break
        }
      }
      // 被追者记分判断
      if (!bullet.isPlaying && this.godman.isCollideWith(bullet)) {
        databus.score += INCREMENT_WHEN_HIT_GOD_MAN
        bullet.playAnimation()
      }
    })

    for (let i = 0, il = databus.badBullets.length; i< il; i++) {
      let badBullet = databus.badBullets[i]
      if (this.player.isCollideWith(badBullet))  {
        // 玩家被击中的效果
        badBullet.playAnimation()
        this.reduceLifeCount()
        if(this.life <= 0) {
          databus.state = STATE.OVER
        }
        break
      }
    }

    for (let i = 0, il = databus.obstacles.length; i < il; i++) {
      let obstacle = databus.obstacles[i]

      if (this.player.isCollideWith(obstacle)) {

        obstacle.playAnimation()
        this.reduceLifeCount()
        if(this.life <= 0) {
          databus.state = STATE.OVER
        }
        break
      }
    }
  }

  //begin 触摸事件
  beginTouchEventHandler = (e) => {
    e.preventDefault()

    let x = e.touches[0].clientX
    let y = e.touches[0].clientY


    let begin = this.gameinfo.btnBegin
    if (x >= begin.startX
      && x <= begin.endX
      && y >= begin.startY
      && y <= begin.endY)
      {
        databus.state = STATE.RUN
        this.restart()
        return
      }
    let rank = this.gameinfo.btnRank
    if (x >= rank.startX
      && x <= rank.endX
      && y >= rank.startY
      && y <= rank.endY)
      {
        databus.state = STATE.RANK
        this.gameinfo.renderRank(ctx)
      }
  }

   //rank 触摸事件
   rankTouchEventHandler = (e) => {
    e.preventDefault()

    let x = e.touches[0].clientX
    let y = e.touches[0].clientY


    let rankClose = this.gameinfo.btnRankClose
    if (x >= rankClose.startX
      && x <= rankClose.endX
      && y >= rankClose.startY
      && y <= rankClose.endY)
      {
        databus.state = STATE.BEGIN
      }
  }

  // 游戏结束后的触摸事件处理逻辑
  touchEventHandler = (e) => {
    e.preventDefault()

    let x = e.touches[0].clientX
    let y = e.touches[0].clientY

    let area = this.gameinfo.btnArea

    if (x >= area.startX
      && x <= area.endX
      && y >= area.startY
      && y <= area.endY){

        this.restart()
        return
      }

    let toBegin = this.gameinfo.btnToBegin
    if (x >= toBegin.startX
      && x <= toBegin.endX
      && y >= toBegin.startY
      && y <= toBegin.endY){

        databus.state = STATE.BEGIN
        return
      }
      let share = this.gameinfo.btnShare
      if (x >= share.startX
        && x <= share.endX
        && y >= share.startY
        && y <= share.endY){

          wx.shareAppMessage()
          return
        }
  }

  reduceLifeCount() {
    this.life -= 1
    this.lifebar.reduceLifeCount()
  }

  /**
   * canvas重绘函数
   * 每一帧重新绘制所有的需要展示的元素
   */
  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    this.bg.render(ctx)

    databus.bullets()
      .concat(databus.obstacles)
      .forEach((item) => {
        item.drawToCanvas(ctx)
      })

    this.player.drawToCanvas(ctx)
    this.godman.drawToCanvas(ctx)
    if(Math.floor(databus.score / GLOW_SHOW_SCORE) > glowShowCount || glowShowTime > 0) {
      if(Math.floor(databus.score / GLOW_SHOW_SCORE) > glowShowCount) {
        glowShowCount++
        glowShowTime = 2000
      }
      glowShowTime -= 50
      this.glow.drawToCanvas(ctx)
    }

    if (this.badman) {
      this.badman.drawToCanvas(ctx)
    }
    databus.animations.forEach((ani) => {
      if (ani.isPlaying) {
        ani.aniRender(ctx)
      }
    })

    this.gameinfo.renderGameScore(ctx, databus.score)
    this.lifebar.render(ctx)

    // 游戏初始化
    if(databus.state === STATE.BEGIN) {
      this.clearTouchEvent()
      this.gameinfo.renderGameBegin(ctx)

      if (!this.hasEventBind) {
        this.hasEventBind = true
        this.touchHandler = this.beginTouchEventHandler
        canvas.addEventListener('touchstart', this.touchHandler)
      }
    }

    if(databus.state === STATE.RANK) {
      this.clearTouchEvent()
      this.gameinfo.renderRank(ctx)
      this.bindTouchEvent(this.rankTouchEventHandler)
    }

    // 游戏结束停止帧循环
    if (databus.state === STATE.OVER) {
      this.gameinfo.renderGameOver(ctx, databus.score)
      this.bindTouchEvent(this.touchEventHandler)
    }
  }

  // 游戏逻辑更新主函数
  update() {
    if (databus.state !== STATE.RUN)
      return;

    this.bg.update()
    this.godman.update()
    this.glow.update(this.godman)
    if (this.badman) {
      this.badman.update()
    }
    databus.bullets()
      .concat(databus.obstacles)
      .forEach((item) => {
        item.update()
      })

    this.obstacleGenerate()

    this.collisionDetection()

    if (databus.frame % 15 === 0) {
      this.player.shoot()
      this.music.playShoot()
    }

    // TODO: FIXME
    if (databus.frame % calcShootingIntervalFrames(databus.score) === 0 && this.badman) {
      this.badman.shoot()
    }

    if (databus.score > 9) {
      this.executeOnceWrapper.executeOnce(() => {
        this.setupBadman()
      })
    }
  }

  // 实现游戏帧循环
  loop() {
    databus.frame++

    this.update()
    this.render()

    this.aniId = window.requestAnimationFrame(
      this.bindLoop,
      canvas
    )
  }

  //清除touch事件
  clearTouchEvent() {
    canvas.removeEventListener(
      'touchstart',
      this.touchHandler
    )
    this.hasEventBind = false
  }

  // 绑定touch事件
  bindTouchEvent(func) {
    if (!this.hasEventBind) {
      this.hasEventBind = true
      this.touchHandler = func
      canvas.addEventListener('touchstart', this.touchHandler)
    }
  }
}
