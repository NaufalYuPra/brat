var mlistDTM = (function() {
    var DTMConfig = {};
    var setDTMConfig = function() {
        DTMConfig.artist = digitalData.content.artist;
        DTMConfig.artisthost = digitalData.page.pageInfo.pageName;
    };
    var DTMConfig = function(event, variant, dtmObj, customPageName) {
        setDTMConfig();
        var mainListID = dtmObj.nListId;
        var closestreg = '';
        var artisthost = DTMConfig.artisthost;
        var artistName = DTMConfig.artist;
        var DTMVars = {};
        //var variant;
        var datasource = dtmObj.dataSource;
        switch (event) {
            case ('signupIntent'):
                if (customPageName) {
                    DTMVars.pageName = artistName + ":" + dtmObj.customPageName + mainListID;
                } else {
                    DTMVars.pageName = artisthost;
                }
				Object.assign(s_dtm, DTMVars);
				_satellite.track("email sign-up");
                break;
            case ('firstFormSubmit'):
                if (customPageName) {
                    DTMVars.pageName = artistName + ":" + dtmObj.customPageName;
                }
				else if (variant) {
                    DTMVars.pageName = artisthost + ":" + variant;
                }
				else {
                    DTMVars.pageName = artisthost;
                }
                
                DTMVars.eVar16 = mainListID;
                if (datasource != null) {
                    DTMVars.eVar87 = datasource;
                }
				Object.assign(s_dtm, DTMVars);
				_satellite.track("email sign-up");
                break;
            case ('noLabelSubscription'):
                if (customPageName) {
                    DTMVars.pageName = artistName + ":" + dtmObj.customPageName;
				}
				else if (variant) {
                    DTMVars.pageName = artisthost + ":" + variant;
                }
				else {
                    DTMVars.pageName = artisthost;
                }
                
                DTMVars.eVar16 = mainListID;
                if (datasource != null) {
                    DTMVars.eVar87 = datasource;
                }
				Object.assign(s_dtm, DTMVars);
				_satellite.track("email sign-up step 2");
                break;
            case ('labelSubscription'):
                var labelid = dtmObj.goptin;
                if (customPageName) {
                    DTMVars.pageName = artistName + ":" + dtmObj.customPageName;
				}
				else if (variant) {
                    DTMVars.pageName = artisthost + ":" + variant;
                }
				else {
                    DTMVars.pageName = artisthost;
                }
                
                DTMVars.eVar16 = mainListID;
                if (datasource != null) {
                    DTMVars.eVar87 = datasource;
                }
				Object.assign(s_dtm, DTMVars);
				_satellite.track("email sign-up step 2");
                break;
            default:
                if (customPageName) {
                    DTMVars.pageName = artistName + ":" + dtmObj.customPageName;
				}
				else if (variant) {
                    DTMVars.pageName = artisthost + ":" + variant;
                }
				else {
                    DTMVars.pageName = artisthost;
                }
				Object.assign(s_dtm, DTMVars);
				_satellite.track("email sign-up step 2");
                break;
        }
        //s_dtm.t(DTMVars);
		//_satellite.track("email sign-up");
    };
    return {
        mailingListDTM: DTMConfig
    };
})();