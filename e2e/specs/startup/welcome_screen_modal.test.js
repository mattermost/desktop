// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('Welcome Screen Modal', function desc() {
    this.timeout(30000);

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        await asyncSleep(1000);

        this.app = await env.getApp();

        welcomeScreenModal = this.app.windows().find((window) => window.url().includes('welcomeScreen'));
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    let welcomeScreenModal;

    it('MM-T4976 should show the slides in the expected order', async () => {
        const welcomeSlideClass = await welcomeScreenModal.getAttribute('#welcome', 'class');
        welcomeSlideClass.should.contain('Carousel__slide-current');
        const welcomeSlideTitle = await welcomeScreenModal.innerText('#welcome .WelcomeScreenSlide__title');
        welcomeSlideTitle.should.equal('Welcome');
        await welcomeScreenModal.click('#nextCarouselButton');

        const channelSlideClass = await welcomeScreenModal.getAttribute('div.Carousel__slide.inFromRight', 'class');
        channelSlideClass.should.contain('Carousel__slide-current');
        const channelSlideTitle = await welcomeScreenModal.innerText('div.Carousel__slide.inFromRight .WelcomeScreenSlide__title');
        channelSlideTitle.should.equal('Collaborate in real time');
        await welcomeScreenModal.click('#nextCarouselButton');

        const callsSlideClass = await welcomeScreenModal.getAttribute('div.Carousel__slide.inFromRight', 'class');
        callsSlideClass.should.contain('Carousel__slide-current');
        const callsSlideTitle = await welcomeScreenModal.innerText('div.Carousel__slide.inFromRight .WelcomeScreenSlide__title');
        callsSlideTitle.should.equal('Start secure calls instantly');
        await welcomeScreenModal.click('#nextCarouselButton');

        const integrationSlideClass = await welcomeScreenModal.getAttribute('div.Carousel__slide.inFromRight', 'class');
        integrationSlideClass.should.contain('Carousel__slide-current');
        const integrationSlideTitle = await welcomeScreenModal.innerText('div.Carousel__slide.inFromRight .WelcomeScreenSlide__title');
        integrationSlideTitle.should.equal('Integrate with tools you love');
        await welcomeScreenModal.click('#nextCarouselButton');
    });

    it('MM-T4977 should be able to move through slides clicking the navigation buttons', async () => {
        let welcomeSlideClass = await welcomeScreenModal.getAttribute('#welcome', 'class');
        welcomeSlideClass.should.contain('Carousel__slide-current');

        await welcomeScreenModal.click('#nextCarouselButton');

        const channelSlideClass = await welcomeScreenModal.getAttribute('div.Carousel__slide.inFromRight', 'class');
        channelSlideClass.should.contain('Carousel__slide-current');

        await welcomeScreenModal.click('#prevCarouselButton');

        welcomeSlideClass = await welcomeScreenModal.getAttribute('#welcome', 'class');
        welcomeSlideClass.should.contain('Carousel__slide-current');
    });

    it('MM-T4978 should be able to move through slides clicking the pagination indicator', async () => {
        const welcomeSlideClass = await welcomeScreenModal.getAttribute('#welcome', 'class');
        welcomeSlideClass.should.contain('Carousel__slide-current');

        await welcomeScreenModal.click('#PaginationIndicator3');

        const integrationSlideClass = await welcomeScreenModal.getAttribute('div.Carousel__slide.inFromRight', 'class');
        integrationSlideClass.should.contain('Carousel__slide-current');

        await welcomeScreenModal.click('#PaginationIndicator2');

        const callsSlideClass = await welcomeScreenModal.getAttribute('div.Carousel__slide.inFromLeft', 'class');
        callsSlideClass.should.contain('Carousel__slide-current');
    });

    it('MM-T4979 should be able to move forward through slides automatically every 5 seconds', async () => {
        const welcomeSlideClass = await welcomeScreenModal.getAttribute('#welcome', 'class');
        welcomeSlideClass.should.contain('Carousel__slide-current');

        await asyncSleep(5500);

        const channelSlideClass = await welcomeScreenModal.getAttribute('div.Carousel__slide.inFromRight', 'class');
        channelSlideClass.should.contain('Carousel__slide-current');
        const channelSlideTitle = await welcomeScreenModal.innerText('div.Carousel__slide.inFromRight .WelcomeScreenSlide__title');
        channelSlideTitle.should.equal('Collaborate in real time');
        await welcomeScreenModal.click('#nextCarouselButton');
    });

    it('MM-T4980 should show the slides in the expected order', async () => {
        const welcomeSlideClass = await welcomeScreenModal.getAttribute('#welcome', 'class');
        welcomeSlideClass.should.contain('Carousel__slide-current');

        await welcomeScreenModal.click('#nextCarouselButton');

        const channelSlideClass = await welcomeScreenModal.getAttribute('div.Carousel__slide.inFromRight', 'class');
        channelSlideClass.should.contain('Carousel__slide-current');

        await welcomeScreenModal.click('#nextCarouselButton');

        const callsSlideClass = await welcomeScreenModal.getAttribute('div.Carousel__slide.inFromRight', 'class');
        callsSlideClass.should.contain('Carousel__slide-current');

        await welcomeScreenModal.click('#nextCarouselButton');

        const integrationSlideClass = await welcomeScreenModal.getAttribute('div.Carousel__slide.inFromRight', 'class');
        integrationSlideClass.should.contain('Carousel__slide-current');
    });

    it('MM-T4981 should be able to move from last to first slide', async () => {
        await welcomeScreenModal.click('#PaginationIndicator3');

        const integrationSlideClass = await welcomeScreenModal.getAttribute('div.Carousel__slide.inFromRight', 'class');
        integrationSlideClass.should.contain('Carousel__slide-current');
        const integrationSlideTitle = await welcomeScreenModal.innerText('div.Carousel__slide.inFromRight .WelcomeScreenSlide__title');
        integrationSlideTitle.should.equal('Integrate with tools you love');

        await welcomeScreenModal.click('#nextCarouselButton');

        const welcomeSlideClass = await welcomeScreenModal.getAttribute('#welcome', 'class');
        welcomeSlideClass.should.contain('Carousel__slide-current');
    });

    it('MM-T4982 should be able to move from first to last slide', async () => {
        const welcomeSlideClass = await welcomeScreenModal.getAttribute('#welcome', 'class');
        welcomeSlideClass.should.contain('Carousel__slide-current');

        await welcomeScreenModal.click('#prevCarouselButton');

        const integrationSlideClass = await welcomeScreenModal.getAttribute('div.Carousel__slide.inFromLeft', 'class');
        integrationSlideClass.should.contain('Carousel__slide-current');
        const integrationSlideTitle = await welcomeScreenModal.innerText('div.Carousel__slide.inFromLeft .WelcomeScreenSlide__title');
        integrationSlideTitle.should.equal('Integrate with tools you love');
    });

    it('MM-T4983 should be able to click the get started button and be redirected to new server modal', async () => {
        await welcomeScreenModal.click('#getStartedWelcomeScreen');

        await asyncSleep(1000);

        const modalCardTitle = await welcomeScreenModal.innerText('.ConfigureServer .ConfigureServer__card-title');
        modalCardTitle.should.equal('Enter your server details');
    });
});
