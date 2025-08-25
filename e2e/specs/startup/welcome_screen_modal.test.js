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

    describe('Welcome Screen to Configure Server with Pre-Auth', () => {
        it('should show configure server screen with pre-auth functionality after clicking get started', async () => {
            await welcomeScreenModal.click('#getStartedWelcomeScreen');
            await asyncSleep(1000);

            // Verify we're on the configure server screen
            const modalCardTitle = await welcomeScreenModal.innerText('.ConfigureServer .ConfigureServer__card-title');
            modalCardTitle.should.equal('Enter your server details');

            // Check that advanced section with pre-auth is available
            await welcomeScreenModal.click('.AdvancedSection button');
            await welcomeScreenModal.waitForSelector('#preAuthSecretInput');
            const preAuthField = await welcomeScreenModal.isVisible('#preAuthSecretInput');
            preAuthField.should.be.true;
        });

        it('should handle pre-auth flow from welcome screen', async () => {
            // Mock server response that requires pre-auth
            await welcomeScreenModal.route('**/api/v4/system/ping', (route) => {
                const authHeader = route.request().headers()['x-mattermost-preauth-secret'];
                if (authHeader === 'welcome-flow-secret') {
                    route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({status: 'OK'}),
                    });
                } else {
                    route.fulfill({
                        status: 403,
                        contentType: 'application/json',
                        body: JSON.stringify({message: 'Pre-authentication required'}),
                    });
                }
            });

            await welcomeScreenModal.click('#getStartedWelcomeScreen');
            await asyncSleep(1000);

            // Fill in server details
            await welcomeScreenModal.type('#input_name', 'WelcomeTestServer');
            await welcomeScreenModal.type('#input_url', 'http://welcome-example.org');

            // Expand advanced section and add pre-auth
            await welcomeScreenModal.click('.AdvancedSection button');
            await welcomeScreenModal.type('#preAuthSecretInput', 'welcome-flow-secret');

            // Wait for successful validation
            await welcomeScreenModal.waitForSelector('#customMessage_url.Input___success');
            const successMessage = await welcomeScreenModal.isVisible('#customMessage_url.Input___success');
            successMessage.should.be.true;

            // Connect to server
            await welcomeScreenModal.click('#connectConfigureServer');
            await asyncSleep(1000);

            // Verify welcome screen is closed
            const welcomeScreenExists = Boolean(await this.app.windows().find((window) => window.url().includes('welcomeScreen')));
            welcomeScreenExists.should.be.false;
        });

        it('should auto-expand advanced section when server requires pre-auth from welcome flow', async () => {
            // Mock server response that requires pre-auth
            await welcomeScreenModal.route('**/api/v4/system/ping', (route) => {
                route.fulfill({
                    status: 403,
                    contentType: 'application/json',
                    body: JSON.stringify({message: 'Pre-authentication required'}),
                });
            });

            await welcomeScreenModal.click('#getStartedWelcomeScreen');
            await asyncSleep(1000);

            // Fill in server details - this should trigger validation
            await welcomeScreenModal.type('#input_name', 'PreAuthServer');
            await welcomeScreenModal.type('#input_url', 'http://preauth-server.org');

            // Advanced section should auto-expand and show pre-auth field
            await welcomeScreenModal.waitForSelector('#preAuthSecretInput', {timeout: 5000});
            const preAuthField = await welcomeScreenModal.isVisible('#preAuthSecretInput');
            preAuthField.should.be.true;

            // Advanced section should be expanded
            const advancedSectionExpanded = await welcomeScreenModal.isVisible('.AdvancedSection__content');
            advancedSectionExpanded.should.be.true;
        });
    });
});
