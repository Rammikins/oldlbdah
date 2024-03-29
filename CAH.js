unique_id = 0;
participantArray = new Array();

gapi.hangout.onApiReady.add(function (eventObj) {
    if (eventObj.isApiReady) {
        //hack for Firefox for now
        Ext.resetElement = Ext.getBody();

        warningPrompt();
    }
});

function warningPrompt() {
    //present game options
    confirmationWindow = Ext.create('Ext.window.Window', {
        title:'BOOM!',
        width:450,
        height:260,
        autoShow: true,
        modal: true,
        collapsible: false,
        resizable: false,
        shadow: false,
        html: 'LBD Against Humanity is a Google+ Hangout app designed for playing a <a href="http://lizziebennet.com" target="_blank">Lizzie Bennet Diaries</a>-themed version of <a href="http://cardsagainsthumanity.com" target="_blank">Cards Against Humanity</a>, based on coding from <a href="http://hangoutsagainsthumanity.com" target="_blank">Hangouts Against Humanity</a>. Please be aware this game is intended for mature audiences, and that <a href="http://twitter.com/Rammi" target="_blank">Rammi</a> probably cannot help you if anything breaks. <br><br> For more information, please see <a href="http://glomp.me/lbd" target="_blank">our website</a>. ',
        buttons: [
            {
                text: 'I have a man banana',
                handler: function () {
                    this.up('window').close();

                    //Google API
                    initGoogleAPI();



                    //tooltip manager
                    Ext.tip.QuickTipManager.init();

                    //init data stores
                    initDataStores();

                    //main app layout
                    initLayout();

                    //update participants
                    sendEvent('updateParticipantsList');
                    defaultFeed = gapi.hangout.layout.getDefaultVideoFeed();
                    videoCanvas = gapi.hangout.layout.getVideoCanvas();
                    //video canvas for reader
                    readerVideoWindow = Ext.create('Ext.window.Window', {
                        title:'Video',
                        id:'readerVideoWindow',
                        width:300,
                        height:200,
                        autoShow: true,
                        closable: false,
                        collapsible: true,
                        minWidth: 250,
                        resizable: {preserveRatio: 'true'},
                        shadow: false,
                        listeners : {
                            'collapse': function (){
                                videoCanvas.setVisible(false);
                            },
                            'expand': function (){
                                videoCanvas.setVisible(true);
                            },
                            'move' : function(win,x,y,opt){
                                videoCanvas.setPosition(x+7,y+28);
                                if (!win.getCollapsed()) {
                                    videoCanvas.setVisible(true);
                                }
                            },
                            'resize': function(self, width, height) {
                                videoCanvas.setWidth(width-19);
                                if (!self.getCollapsed()) {
                                    videoCanvas.setVisible(true);
                                }
                            }
                        }
                    });
                    $('#readerVideoWindow').mousedown(function () {videoCanvas.setVisible(false);});
                    resetVideoWindow();

                    var soundURL = 'http://dl.dropbox.com/u/44863/LBD/img/Winner.mp3';
                    winnerSound = gapi.hangout.av.effects.createAudioResource(soundURL).createSound({loop: false, localOnly: true});

                    //check if game starter and if so sync to game state
                    if (typeof gapi.hangout.data.getValue('winningPoints') !== "undefined") {
                        console.log("game is ongoing, attempting to sync state");
                        console.log("Goal:"+  gapi.hangout.data.getValue('winningPoints'));
                        if (typeof gapi.hangout.data.getValue('turn') !== "undefined") {console.log("Turn:"+gapi.hangout.data.getValue('turn'));}
                        if (typeof gapi.hangout.data.getValue('sets') !== "undefined") { console.log("Sets"+gapi.hangout.data.getValue('sets'));}
                        if (typeof gapi.hangout.data.getValue('masterCardsPicked') !== "undefined") { console.log("Cards picked:"+gapi.hangout.data.getValue('masterCardsPicked'));}
                        syncNewPlayer();
                    }
                }
            },
            {
                text: 'Cancel',
                handler: function () {
                    $('body').html('<img src="https://twimg0-a.akamaihd.net/profile_background_images/3806495/testing.jpg">');
                }
            }
        ]
    });
}

function syncNewPlayer() {
    //winningPoints
    winningPoints = parseInt(gapi.hangout.data.getValue('winningPoints'));

    //game is ongoing
    gameStarted = true;

    //disable start game button
    Ext.getCmp('startGameButton').hide();
    Ext.getCmp('goalDisplay').setValue(winningPoints);
    Ext.getCmp('goalDisplay').show();

    //initialize decks
    initDecks(JSON.parse(gapi.hangout.data.getValue('sets')));

    //get all cards picked so far
    var masterCardsString = gapi.hangout.data.getValue('masterCardsPicked');
    if (masterCardsString != "") {
        masterCardsPicked = masterCardsString.split(',');
    }
    for (var i; i<masterCardsPicked.length;i++) {
        var questionRec = remainingQuestionStore.findRecord('id', masterCardsPicked[i], 0, false, false, true);
        if (questionRec){
            remainingQuestionStore.remove(questionRec);
        }
        var answerRec = remainingAnswerStore.findRecord('id', masterCardsPicked[i], 0, false, false, true);
        if (answerRec){
            remainingAnswerStore.remove(answerRec);
        }
    }

    //correct the turn
    Ext.getCmp('turnCounter').setValue(parseInt(gapi.hangout.data.getValue('turn')));
}

//controller functions
function updateParticipantsList() {
    participantArray = gapi.hangout.getEnabledParticipants();
    for (var i=0; i<participantArray.length;i++) {
        var match = playerStore.query("id", participantArray[i].person.id, false, false, true);
        if (match.length == 0) {
            playerStore.add({
                id: participantArray[i].person.id,
                name: participantArray[i].person.displayName,
                imageURL: participantArray[i].person.image.url,
                points: 0,
                displayIndex: 0 || participantArray[i].displayIndex,
                participantID: participantArray[i].id,
                cardsInHand: 0
            });
        }
    }

    //remove players no longer in the game
    var playersToRemove = new Array();
    playerStore.each(function (playerRec) {
        found = false;
        for (var i=0; i<participantArray.length;i++) {
            if (participantArray[i].id == playerRec.getData().participantID) {
                found = true;
            }
        }
        if (!found) {
            playersToRemove.push(playerRec);
        }
    });


    for (var i=0; i<playersToRemove.length;i++) {
        playerStore.remove(playersToRemove[i]);
    }

    Ext.getCmp('playerGrid').store.sort([
        { property: 'name', direction: 'ASC' }
    ]);
}

//Helper functions
function uniqid()
{
    unique_id++;
    return user.id+unique_id;
}

function resetVideoWindow() {
    readerVideoWindow.alignTo(Ext.getBody(), "tr-tr", [-10, 100]);
    readerVideoWindow.setWidth(300);
    readerVideoWindow.setHeight(200);
    videoCanvas.setWidth(readerVideoWindow.getWidth()-19);
    videoCanvas.setVideoFeed(defaultFeed);
    var pos = readerVideoWindow.getPosition();
    videoCanvas.setPosition(pos[0]+7, pos[1]+28);
    videoCanvas.setVisible(true);

}

function createTextOverlay(string) {
    // Create a canvas to draw on
    var canvas = document.createElement('canvas');
    canvas.setAttribute('width', 166);
    canvas.setAttribute('height', 100);

    var context = canvas.getContext('2d');

    // Draw background
    context.fillStyle = '#BBB';
    context.fillRect(0,0,166,50);

    // Draw text
    context.font = '32pt Impact';
    context.lineWidth = 6;
    context.lineStyle = '#000';
    context.fillStyle = '#FFF';
    context.fillColor = '#ffff00';
    context.fillColor = '#ffff00';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.strokeText(string, canvas.width / 2, canvas.height / 2);
    context.fillText(string, canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL();
}

