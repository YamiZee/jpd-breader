import { Keybind } from '../background/config.js';
import { config, requestMine, requestReview, requestSetFlag } from './background_comms.js';
import { Dialog } from './dialog.js';
import { Popup } from './popup.js';
import { showError } from './toast.js';
import { getSentences, JpdbWord } from './word.js';

export let currentHover: [JpdbWord, number, number] | null = null;
let popupKeyHeld = false;

function moveParentLinkIfExists(element: HTMLElement | undefined) {
  if (!element || (config && !config.moveLinksToPopup)) {
    return;
  }

  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName.toLowerCase() === 'a' && parent.getAttribute('href')) {
      const href = `${parent.getAttribute('href')}`;
      parent.removeAttribute('href');

      // Add original-link to all JPDB words in link
      parent.querySelectorAll('.jpdb-word').forEach(word => {
        word.setAttribute('original-link', href);
      });

      return href;
    }
    parent = parent.parentElement;
  }

  return;
}

function matchesHotkey(event: KeyboardEvent | MouseEvent, hotkey: Keybind) {
  const code = event instanceof KeyboardEvent ? event.code : `Mouse${event.button}`;
  return hotkey && code === hotkey.code && hotkey.modifiers.every(name => event.getModifierState(name));
}

async function hotkeyListener(event: KeyboardEvent | MouseEvent) {
  try {
    if (matchesHotkey(event, config.showPopupKey) && !config.showPopupOnHover) {
      event.preventDefault();
      popupKeyHeld = true;

      const popup = Popup.get();
      popup.disablePointer();

      if (!currentHover) {
        popup.fadeOut();
      }
    }

    if (currentHover) {
      const [word, x, y] = currentHover;
      const card = word.jpdbData.token.card;

      if (matchesHotkey(event, config.addKey)) {
        await requestMine(
          word.jpdbData.token.card,
          config.forqOnMine,
          getSentences(word.jpdbData, config.contextWidth).trim() || undefined,
          undefined,
        );
      }

      if (matchesHotkey(event, config.dialogKey)) {
        Dialog.get().showForWord(word.jpdbData);
      }

      if (matchesHotkey(event, config.showPopupKey)) {
        event.preventDefault();
        Popup.get().showForWord(word, x, y);
      }
      if (config.showPopupOnMouseLeft && event instanceof MouseEvent && event.buttons == 1) {
        Popup.get().showForWord(word, x, y);
      }

      if (matchesHotkey(event, config.blacklistKey)) {
        event.preventDefault();
        await requestSetFlag(card, 'blacklist', !card.state.includes('blacklisted'));
      }

      if (matchesHotkey(event, config.neverForgetKey)) {
        event.preventDefault();
        await requestSetFlag(card, 'never-forget', !card.state.includes('never-forget'));
      }

      if (matchesHotkey(event, config.nothingKey)) {
        event.preventDefault();
        await requestReview(card, 'nothing');
      }

      if (matchesHotkey(event, config.somethingKey)) {
        event.preventDefault();
        await requestReview(card, 'something');
      }

      if (matchesHotkey(event, config.hardKey)) {
        event.preventDefault();
        if (config && !config.disablePopupAutoClose) {
          Popup.get().fadeOut();
        }
        await requestReview(card, 'hard');
      }

      if (matchesHotkey(event, config.goodKey)) {
        event.preventDefault();
        if (config && !config.disablePopupAutoClose) {
          Popup.get().fadeOut();
        }
        await requestReview(card, 'good');
      }

      if (matchesHotkey(event, config.easyKey)) {
        event.preventDefault();
        if (config && !config.disablePopupAutoClose) {
          Popup.get().fadeOut();
        }
        await requestReview(card, 'easy');
      }
    }
  } catch (error) {
    showError(error);
  }
}

window.addEventListener('keydown', hotkeyListener);
window.addEventListener('mousedown', hotkeyListener);

function hidePopupHotkeyListener(event: KeyboardEvent | MouseEvent) {
  if (matchesHotkey(event, config.showPopupKey)) {
    event.preventDefault();
    popupKeyHeld = false;
    Popup.get().enablePointer();
  }
}

window.addEventListener('keyup', hidePopupHotkeyListener);
window.addEventListener('mouseup', hidePopupHotkeyListener);

document.addEventListener('mousedown', e => {
  if (config.touchscreenSupport) {
    // to prevent issues with simultaneous showing and hiding
    // and to allow clicking on the popup without making it disappear.
    if (currentHover == null && !Popup.get().containsMouse(e)) {
      Popup.get().fadeOut();
    }
  } else {
    Popup.get().fadeOut();
  }
});

export function onWordHoverStart({ target, x, y }: MouseEvent) {
  if (target === null) return;
  currentHover = [target as JpdbWord, x, y];

  moveParentLinkIfExists((target as HTMLElement) ?? null);

  if (popupKeyHeld || config.showPopupOnHover || config.touchscreenSupport) {
    // On mobile devices, the position of the popup is occasionally adjusted to ensure
    // it remains on the screen. However, due to the interaction between the 'onmouseenter'
    // event and the popup, there are instances where the popup appears and at the same
    // time a (review) button is being clicked.
    if (config.touchscreenSupport) {
      Popup.get().disablePointer();

      setTimeout(() => {
        Popup.get().enablePointer();
      }, 400);
    }

    Popup.get().showForWord(target as JpdbWord, x, y);
  }
}

export function onWordHoverStop() {
  currentHover = null;
}

// For video players (may cause issues if some keybinds are also set to space)
window.addEventListener(
  'keydown',
  function (event) {
    if (event.code === 'Space') {
      Popup.get().fadeOut();
    }
  },
  true,
);
