// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export default class Finder {
  constructor(target) {
    this.target = target;
  }

  toggle() {
    return this.opened ? this.close() : this.open();
  }

  open() {
    if (!this.initialized) {
      this.initialize();
    }
    this.opened = true;
    this.$finder.classList.remove('finder__hidden');
    this.$input.focus();
  }

  close = () => {
    this.opened = false;
    this.target.stopFindInPage('clearSelection');
    this.$finder.classList.add('finder__hidden');
  }

  findNext = () => {
    if (this.$input.value) {
      this.target.findInPage(this.$input.value);
    }
  }

  findPrev = () => {
    if (this.$input.value) {
      this.target.findInPage(this.$input.value, {forward: false});
    }
  }

  find = (keyword) => {
    this.target.stopFindInPage('clearSelection');
    if (keyword) {
      this.target.findInPage(keyword);
    } else {
      this.$progress.textContent = '0/0';
    }
  }

  handleKeyEvent = (event) => {
    if (event.code === 'Escape') {
      this.close();
    } else if (event.code === 'Enter') {
      this.findNext();
    } else {
      this.find(event.target.value);
    }
  }

  foundInPage = (event) => {
    const {matches, activeMatchOrdinal} = event.result;
    this.$progress.classList.remove('finder-progress__disabled');
    this.$progress.textContent = `${activeMatchOrdinal}/${matches}`;
  }

  destroy() {
    this.initialized = false;
    if (this.$input) {
      this.$input.removeEventListener('keyup', this.handleKeyEvent);
      this.$prev.removeEventListener('click', this.findPrev);
      this.$next.removeEventListener('click', this.findNext);
      this.$close.removeEventListener('click', this.close);
      this.target.removeEventListener('found-in-page', this.foundInPage);
      const searchDiv = document.getElementById('searchDiv');
      searchDiv.parentNode.removeChild(searchDiv);
    }
  }

  initialize() {
    this.initialized = true;
    const wrapper = document.createElement('div');
    wrapper.setAttribute('id', 'searchDiv');
    wrapper.innerHTML = `
    <div class="finder finder__hidden">
      <div class="finder-input-wrapper">
        <input class="finder-input" placeholder="" />
        <span class="finder-progress finder-progress__disabled"></span>
      </div>
      <button class="finder-prev">↑</button>
      <button class="finder-next">↓</button>
      <button class="finder-close">✕</button>
    </div>`;

    document.body.appendChild(wrapper);

    this.$finder = wrapper.querySelector('.finder');
    this.$progress = this.$finder.querySelector('.finder-progress');
    this.$input = this.$finder.querySelector('.finder-input');
    this.$prev = this.$finder.querySelector('.finder-prev');
    this.$next = this.$finder.querySelector('.finder-next');
    this.$close = this.$finder.querySelector('.finder-close');

    this.$input.addEventListener('keyup', this.handleKeyEvent);
    this.$prev.addEventListener('click', this.findPrev);
    this.$next.addEventListener('click', this.findNext);
    this.$close.addEventListener('click', this.close);
    this.target.addEventListener('found-in-page', this.foundInPage);
  }
}
