/** 跨平台輸入：鍵盤（WASD／方向鍵）＋ 觸控虛擬搖桿，合成單一移動方向 */
export class Input {
  private keys = new Set<string>();
  /** 觸控搖桿方向（已正規化，-1~1） */
  private joystick = { x: 0, z: 0 };

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key.toLowerCase());
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  attach() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  /** 由 Vue 搖桿元件呼叫 */
  setJoystick(x: number, z: number) {
    this.joystick.x = x;
    this.joystick.z = z;
  }

  /** 取得正規化後的移動方向（世界 x/z） */
  getDirection(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) z += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) z -= 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;

    /** 鍵盤無輸入時改用搖桿 */
    if (x === 0 && z === 0) {
      x = this.joystick.x;
      z = this.joystick.z;
    }

    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }
}
