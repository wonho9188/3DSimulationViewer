// keyboardForGame.ts
// React/Three.js에서 사용할 수 있도록 변환한 키보드 상태 관리 클래스

export class KeyboardForGame {
  private keyCodes: { [key: number]: boolean } = {};
  private modifiers: { [key: string]: boolean } = {};
  private _onKeyDown: (event: KeyboardEvent) => void;
  private _onKeyUp: (event: KeyboardEvent) => void;

  static MODIFIERS = ['shift', 'ctrl', 'alt', 'meta'];
  static ALIAS: { [key: string]: number } = {
    left: 37,
    up: 38,
    right: 39,
    down: 40,
    space: 32,
    pageup: 33,
    pagedown: 34,
    tab: 9,
  };

  constructor() {
    this._onKeyDown = (event) => this._onKeyChange(event, true);
    this._onKeyUp = (event) => this._onKeyChange(event, false);
    document.addEventListener('keydown', this._onKeyDown, false);
    document.addEventListener('keyup', this._onKeyUp, false);
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown, false);
    document.removeEventListener('keyup', this._onKeyUp, false);
  }

  private _onKeyChange(event: KeyboardEvent, pressed: boolean) {
    const keyCode = event.keyCode;
    this.keyCodes[keyCode] = pressed;
    this.modifiers['shift'] = event.shiftKey;
    this.modifiers['ctrl'] = event.ctrlKey;
    this.modifiers['alt'] = event.altKey;
    this.modifiers['meta'] = event.metaKey;
  }

  pressed(keyDesc: string): boolean {
    const keys = keyDesc.split('+');
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      let pressed;
      if (KeyboardForGame.MODIFIERS.indexOf(key) !== -1) {
        pressed = this.modifiers[key];
      } else if (Object.keys(KeyboardForGame.ALIAS).indexOf(key) !== -1) {
        pressed = this.keyCodes[KeyboardForGame.ALIAS[key]];
      } else {
        pressed = this.keyCodes[key.toUpperCase().charCodeAt(0)];
      }
      if (!pressed) return false;
    }
    return true;
  }
}
