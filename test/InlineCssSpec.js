describe("Inline CSS content", function () {
    var joinUrlSpy, ajaxSpy, binaryAjaxSpy, getDataURIForImageURLSpy,
        callback;

    beforeEach(function () {
        joinUrlSpy = spyOn(rasterizeHTMLInline.util, "joinUrl").andCallFake(function (base, url) {
            return url;
        });
        ajaxSpy = spyOn(rasterizeHTMLInline.util, "ajax");
        binaryAjaxSpy = spyOn(rasterizeHTMLInline.util, "binaryAjax");
        getDataURIForImageURLSpy = spyOn(rasterizeHTMLInline.util, "getDataURIForImageURL");

        callback = jasmine.createSpy("callback");
    });

    describe("extractCssUrl", function () {
        it("should extract a CSS URL", function () {
            var url = rasterizeHTMLInline.css.extractCssUrl('url(path/file.png)');
            expect(url).toEqual("path/file.png");
        });

        it("should handle double quotes", function () {
            var url = rasterizeHTMLInline.css.extractCssUrl('url("path/file.png")');
            expect(url).toEqual("path/file.png");
        });

        it("should handle single quotes", function () {
            var url = rasterizeHTMLInline.css.extractCssUrl("url('path/file.png')");
            expect(url).toEqual("path/file.png");
        });

        it("should handle whitespace", function () {
            var url = rasterizeHTMLInline.css.extractCssUrl('url(   path/file.png )');
            expect(url).toEqual("path/file.png");
        });

        it("should also handle tab, line feed, carriage return and form feed", function () {
            var url = rasterizeHTMLInline.css.extractCssUrl('url(\t\r\f\npath/file.png\t\r\f\n)');
            expect(url).toEqual("path/file.png");
        });

        it("should keep any other whitspace", function () {
            var url = rasterizeHTMLInline.css.extractCssUrl('url(\u2003\u3000path/file.png)');
            expect(url).toEqual("\u2003\u3000path/file.png");
        });

        it("should handle whitespace with double quotes", function () {
            var url = rasterizeHTMLInline.css.extractCssUrl('url( "path/file.png"  )');
            expect(url).toEqual("path/file.png");
        });

        it("should handle whitespace with single quotes", function () {
            var url = rasterizeHTMLInline.css.extractCssUrl("url( 'path/file.png'  )");
            expect(url).toEqual("path/file.png");
        });

        it("should extract a data URI", function () {
            var url = rasterizeHTMLInline.css.extractCssUrl('url("data:image/png;base64,soMEfAkebASE64=")');
            expect(url).toEqual("data:image/png;base64,soMEfAkebASE64=");
        });

        it("should throw an exception on invalid CSS URL", function () {
            expect(function () {
                rasterizeHTMLInline.css.extractCssUrl('invalid_stuff');
            }).toThrow(new Error("Invalid url"));
        });
    });

    describe("adjustPathsOfCssResources", function () {
        var extractCssUrlSpy;

        beforeEach(function () {
            extractCssUrlSpy = spyOn(rasterizeHTMLInline.css, "extractCssUrl").andCallFake(function (cssUrl) {
                if (/^url/.test(cssUrl)) {
                    return cssUrl.replace(/^url\("?/, '').replace(/"?\)$/, '');
                } else {
                    throw "error";
                }
            });
        });

        it("should map background paths relative to the stylesheet", function () {
            var rules = CSSOM.parse('div { background-image: url("../green.png"); }').cssRules;

            joinUrlSpy.andCallFake(function (base, url) {
                if (url === "../green.png" && base === "below/some.css") {
                    return "green.png";
                }
            });

            rasterizeHTMLInline.css.adjustPathsOfCssResources("below/some.css", rules);

            expect(rules[0].style.getPropertyValue('background-image')).toMatch(/url\(\"?green\.png\"?\)/);
        });

        it("should map font paths relative to the stylesheet", function () {
            var rules = CSSOM.parse('@font-face { font-family: "test font"; src: url("fake.woff"); }').cssRules;

            joinUrlSpy.andCallFake(function (base, url) {
                if (url === "fake.woff" && base === "below/some.css") {
                    return "below/fake.woff";
                }
            });

            rasterizeHTMLInline.css.adjustPathsOfCssResources("below/some.css", rules);

            expect(rules[0].style.getPropertyValue('src')).toMatch(/url\(\"?below\/fake\.woff\"?\)/);
        });

        it("should map import paths relative to the stylesheet", function () {
            var rules = CSSOM.parse('@import url(my.css);').cssRules;

            joinUrlSpy.andCallFake(function (base, url) {
                if (url === "my.css" && base === "below/some.css") {
                    return "below/my.css";
                }
            });

            rasterizeHTMLInline.css.adjustPathsOfCssResources("below/some.css", rules);

            expect(rules[0].href).toEqual('below/my.css');
        });

        ifNotInPhantomJsIt("should keep all src references intact when mapping resource paths", function () {
            var rules = CSSOM.parse('@font-face { font-family: "test font"; src: local("some font"), url("fake.woff"); }').cssRules;

            joinUrlSpy.andCallFake(function (base, url) {
                if (base === "some_url/some.css") {
                    return "some_url/" + url;
                }
            });

            rasterizeHTMLInline.css.adjustPathsOfCssResources("some_url/some.css", rules);

            expect(rules[0].style.getPropertyValue('src')).toMatch(/local\("?some font"?\), url\(\"?some_url\/fake\.woff\"?\)/);
        });

        it("should keep the font-family when inlining with Webkit", function () {
            var rules = CSSOM.parse("@font-face { font-family: 'test font'; src: url(\"fake.woff\"); }").cssRules;

            joinUrlSpy.andCallFake(function (base, url) {
                if (base === "some_url/some.css") {
                    return "some_url/" + url;
                }
            });

            rasterizeHTMLInline.css.adjustPathsOfCssResources("some_url/some.css", rules);

            expect(rules[0].style.getPropertyValue('font-family')).toMatch(/["']test font["']/);
        });

        it("should keep the font-style when inlining with Webkit", function () {
            var rules = CSSOM.parse("@font-face { font-family: 'test font'; font-style: italic; src: url(\"fake.woff\"); }").cssRules;

            joinUrlSpy.andCallFake(function (base, url) {
                if (base === "some_url/some.css") {
                    return "some_url/" + url;
                }
            });

            rasterizeHTMLInline.css.adjustPathsOfCssResources("some_url/some.css", rules);

            expect(rules[0].style.getPropertyValue('font-style')).toEqual('italic');
        });

        it("should keep the font-weight when inlining with Webkit", function () {
            var rules = CSSOM.parse("@font-face { font-family: 'test font'; font-weight: 700; src: url(\"fake.woff\"); }").cssRules;

            joinUrlSpy.andCallFake(function (base, url) {
                if (base === "some_url/some.css") {
                    return "some_url/" + url;
                }
            });

            rasterizeHTMLInline.css.adjustPathsOfCssResources("some_url/some.css", rules);

            expect(rules[0].style.getPropertyValue('font-weight')).toEqual('700');
        });
    });

    describe("loadCSSImportsForRules", function () {
        var adjustPathsOfCssResourcesSpy,
            ajaxUrlMocks = {};

        var setupAjaxMock = function () {
            ajaxSpy.andCallFake(function (url) {
                var defer = ayepromise.defer();
                if (ajaxUrlMocks[url] !== undefined) {
                    defer.resolve(ajaxUrlMocks[url]);
                } else {
                    defer.reject({
                        url: 'THEURL' + url
                    });
                }
                return defer.promise;
            });
        };

        var mockAjaxUrl = function (url, content) {
            ajaxUrlMocks[url] = content;
        };

        beforeEach(function () {
            adjustPathsOfCssResourcesSpy = spyOn(rasterizeHTMLInline.css, 'adjustPathsOfCssResources');

            setupAjaxMock();
        });

        it("should replace an import with the content of the given URL", function (done) {
            var rules = CSSOM.parse('@import url("that.css");').cssRules;

            mockAjaxUrl('that.css', "p { font-size: 10px; }");

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function (result) {
                expect(result.hasChanges).toBe(true);

                expect(rules.length).toEqual(1);
                expect(rules[0].cssText).toMatch(/p \{\s*font-size: 10px;\s*\}/);

                done();
            });
        });

        it("should inline multiple linked CSS and keep order", function (done) {
            var rules = CSSOM.parse('@import url("this.css");\n' +
                '@import url("that.css");').cssRules;

            mockAjaxUrl('this.css', "div { display: inline-block; }");
            mockAjaxUrl('that.css', "p { font-size: 10px; }");

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function () {
                expect(rules[0].cssText).toMatch(/div \{\s*display: inline-block;\s*\}/);
                expect(rules[1].cssText).toMatch(/p \{\s*font-size: 10px;\s*\}/);

                done();
            });

        });

        it("should support an import without the functional url() form", function (done) {
            var rules = CSSOM.parse('@import "that.css";').cssRules;

            mockAjaxUrl('that.css', "");

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function () {
                expect(ajaxSpy).toHaveBeenCalledWith("that.css", jasmine.any(Object));

                done();
            });

        });

        it("should handle empty content", function (done) {
            var rules = CSSOM.parse('@import url("that.css");').cssRules;

            mockAjaxUrl('that.css', "");

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function () {
                expect(rules.length).toEqual(0);

                done();
            });

        });

        it("should not add CSS if no content is given", function (done) {
            var rules = CSSOM.parse('@import url("that.css");\n' +
                '@import url("this.css");').cssRules;

            mockAjaxUrl('that.css', "");
            mockAjaxUrl('this.css', "span { font-weight: bold; }");

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function () {
                expect(rules.length).toEqual(1);

                done();
            });

        });

        it("should ignore invalid values", function (done) {
            var rules = CSSOM.parse('@import   invalid url;').cssRules;

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function (result) {
                expect(result.hasChanges).toBe(false);

                done();
            });
        });

        it("should not touch unrelated CSS", function (done) {
            var rules = CSSOM.parse('span {   padding-left: 0; }').cssRules;

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function (result) {
                expect(result.hasChanges).toBe(false);

                done();
            });
        });

        it("should not include a document more than once", function (done) {
            var rules = CSSOM.parse('@import url("that.css");\n' +
                '@import url("that.css");').cssRules;

            mockAjaxUrl('that.css', 'p { font-size: 12px; }');

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function () {
                expect(ajaxSpy.callCount).toEqual(1);
                expect(rules.length).toEqual(1);

                done();
            });

        });

        it("should handle import in an import", function (done) {
            var rules = CSSOM.parse('@import url("this.css");').cssRules;

            mockAjaxUrl("this.css", '@import url("that.css");');
            mockAjaxUrl("that.css", 'p { font-weight: bold; }');

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function () {
                expect(rules.length).toEqual(1);
                expect(rules[0].cssText).toMatch(/p \{\s*font-weight: bold;\s*\}/);

                done();
            });
        });

        it("should handle cyclic imports", function (done) {
            var rules = CSSOM.parse('@import url("this.css");').cssRules;

            mockAjaxUrl("this.css",
                '@import url("that.css");\n' +
                'span { font-weight: 300; }');
            mockAjaxUrl("that.css",
                '@import url("this.css");\n' +
                'p { font-weight: bold; }');

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function () {
                expect(rules[0].cssText).toMatch(/p \{\s*font-weight: bold;\s*\}/);
                expect(rules[1].cssText).toMatch(/span \{\s*font-weight: 300;\s*\}/);

                done();
            });
        });

        it("should handle recursive imports", function (done) {
            var rules = CSSOM.parse('@import url("this.css");').cssRules;

            mockAjaxUrl("this.css", '@import url("this.css");');

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function () {
                expect(ajaxSpy.callCount).toEqual(1);
                expect(rules.length).toEqual(0);

                done();
            });
        });

        it("should handle a baseUrl", function (done) {
            var rules = CSSOM.parse('@import url("that.css");').cssRules;

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {baseUrl: 'url_base/page.html'}).then(function () {
                expect(joinUrlSpy).toHaveBeenCalledWith('url_base/page.html', "that.css");

                done();
            });
        });

        it("should map resource paths relative to the stylesheet", function (done) {
            var rules = CSSOM.parse('@import url("url_base/that.css");').cssRules;

            joinUrlSpy.andCallFake(function (base) {
                if (base === "") {
                    return base;
                }
            });
            mockAjaxUrl('url_base/that.css',
                'div { background-image: url("../green.png"); }\n' +
                '@font-face { font-family: "test font"; src: url("fake.woff"); }');

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function () {
                expect(adjustPathsOfCssResourcesSpy).toHaveBeenCalledWith('url_base/that.css', jasmine.any(Object));
                expect(adjustPathsOfCssResourcesSpy.mostRecentCall.args[1][0].style.getPropertyValue('background-image')).toMatch(/url\(\"?\.\.\/green\.png\"?\)/);

                done();
            });
        });

        it("should circumvent caching if requested", function (done) {
            var rules = CSSOM.parse('@import url("that.css");').cssRules;

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {cache: 'none'}).then(function () {
                expect(ajaxSpy).toHaveBeenCalledWith("that.css", {
                    cache: 'none'
                });

                done();
            });
        });

        it("should not circumvent caching by default", function (done) {
            var rules = CSSOM.parse('@import url("that.css");').cssRules;

            rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function () {
                expect(ajaxSpy).toHaveBeenCalledWith("that.css", {});

                done();
            });
        });

        describe("error handling", function () {
            beforeEach(function () {
                joinUrlSpy.andCallThrough();

                mockAjaxUrl("existing_document.css", "");
                mockAjaxUrl("existing_with_second_level_nonexisting.css",
                    '@import url("nonexisting.css");');
            });

            it("should report an error if a stylesheet could not be loaded", function (done) {
                var rules = CSSOM.parse('@import url("does_not_exist.css");').cssRules;

                rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function (result) {
                    var errors = rasterizeHTMLTestHelper.deleteAdditionalFieldsFromErrorsUnderPhantomJS(result.errors);
                    expect(result.hasChanges).toEqual(false);
                    expect(errors).toEqual([{
                        resourceType: "stylesheet",
                        url: "THEURL" + "does_not_exist.css",
                        msg: "Unable to load stylesheet " + "THEURL" + "does_not_exist.css"
                    }]);

                    done();
                });
            });

            it("should only report a failing stylesheet as error", function (done) {
                var rules = CSSOM.parse('@import url("existing_document.css");\n' +
                    '@import url("does_not_exist.css");').cssRules;

                rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function (result) {
                    var errors = rasterizeHTMLTestHelper.deleteAdditionalFieldsFromErrorsUnderPhantomJS(result.errors);
                    expect(errors).toEqual([{
                        resourceType: "stylesheet",
                        url: "THEURL" + "does_not_exist.css",
                        msg: jasmine.any(String)
                    }]);

                    done();
                });
            });

            it("should report multiple failing stylesheets as error", function (done) {
                var rules = CSSOM.parse('@import url("does_not_exist.css");\n' +
                    '@import url("also_does_not_exist.css");').cssRules;

                rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function (result) {
                    expect(result.errors).toEqual([jasmine.any(Object), jasmine.any(Object)]);
                    expect(result.errors[0]).not.toEqual(result.errors[1]);

                    done();
                });
            });

            it("should report errors from second level @imports", function (done) {
                var rules = CSSOM.parse('@import url("existing_with_second_level_nonexisting.css");').cssRules;

                rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function (result) {
                    var errors = rasterizeHTMLTestHelper.deleteAdditionalFieldsFromErrorsUnderPhantomJS(result.errors);
                    expect(errors).toEqual([{
                            resourceType: "stylesheet",
                            url: "THEURL" + "nonexisting.css",
                            msg: jasmine.any(String)
                        }
                    ]);

                    done();
                });
            });

            it("should report an empty list for a successful stylesheet", function (done) {
                var rules = CSSOM.parse('@import url("existing_document.css");').cssRules;

                rasterizeHTMLInline.css.loadCSSImportsForRules(rules, [], {}).then(function (result) {
                    expect(result.errors).toEqual([]);

                    done();
                });
            });
        });
    });

    describe("loadAndInlineCSSResourcesForRules", function () {
        var extractCssUrlSpy,
            urlMocks = {};

        var setupGetDataURIForImageURLMock = function () {
            getDataURIForImageURLSpy.andCallFake(function (url) {
                var defer = ayepromise.defer();
                if (urlMocks[url] !== undefined) {
                    defer.resolve(urlMocks[url]);
                } else {
                    defer.reject();
                }
                return defer.promise;
            });
        };

        var mockGetDataURIForImageURL = function (imageUrl, imageDataUri) {
            urlMocks[imageUrl] = imageDataUri;
        };

        beforeEach(function () {
            extractCssUrlSpy = spyOn(rasterizeHTMLInline.css, "extractCssUrl").andCallFake(function (cssUrl) {
                if (/^url/.test(cssUrl)) {
                    return cssUrl.replace(/^url\("?/, '').replace(/"?\)$/, '');
                } else {
                    throw "error";
                }
            });

            setupGetDataURIForImageURLMock();
        });

        it("should work with empty content", function () {
            rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules([], {}, callback);

            expect(callback).toHaveBeenCalled();
        });

        describe("on background-image", function () {
            it("should not touch an already inlined background-image", function () {
                var rules = CSSOM.parse('span { background-image: url("data:image/png;base64,soMEfAkebASE64="); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, callback);

                expect(callback).toHaveBeenCalledWith(false, []);
                expect(rules[0].style.getPropertyValue('background-image')).toEqual('url("data:image/png;base64,soMEfAkebASE64=")');
            });

            it("should ignore invalid values", function () {
                var rules = CSSOM.parse('span { background-image: "invalid url"; }').cssRules;

                extractCssUrlSpy.andCallFake(function () {
                    throw new Error("Invalid url");
                });

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, callback);

                expect(callback).toHaveBeenCalledWith(false, []);
                expect(rules[0].style.getPropertyValue('background-image')).toEqual('"invalid url"');
            });

            it("should inline a background-image", function (done) {
                var anImage = "anImage.png",
                    anImagesDataUri = "data:image/png;base64,someDataUri",
                    rules = CSSOM.parse('span { background-image: url("' + anImage + '"); }').cssRules;

                mockGetDataURIForImageURL(anImage, anImagesDataUri);

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function (changed) {
                    expect(changed).toBe(true);

                    expect(extractCssUrlSpy.mostRecentCall.args[0]).toMatch(new RegExp('url\\("?' + anImage + '"?\\)'));

                    expect(rules[0].style.getPropertyValue('background-image')).toEqual('url("' + anImagesDataUri + '")');

                    done();
                });
            });

            it("should inline a background declaration", function (done) {
                var anImage = "anImage.png",
                    anImagesDataUri = "data:image/png;base64,someDataUri",
                    rules = CSSOM.parse('span { background: url("' + anImage + '") top left, url("data:image/png;base64,someMoreDataUri") #FFF; }').cssRules;

                mockGetDataURIForImageURL(anImage, anImagesDataUri);

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function () {
                    expect(rules[0].cssText).toMatch(/(background: [^;]*url\("?data:image\/png;base64,someDataUri"?\).*\s*top\s*.*, .*url\("?data:image\/png;base64,someMoreDataUri"?\).*;)|(background-image:\s*url\("?data:image\/png;base64,someDataUri"?\)\s*,\s*url\("?data:image\/png;base64,someMoreDataUri"?\)\s*;)/);

                    done();
                });
            });

            it("should inline multiple background-images in one rule", function (done) {
                var backgroundImageRegex = /url\("?([^\)"]+)"?\)\s*,\s*url\("?([^\)"]+)"?\)/,
                    anImage = "anImage.png",
                    anImagesDataUri = "data:image/png;base64,someDataUri",
                    aSecondImage = "aSecondImage.png",
                    aSecondImagesDataUri = "data:image/png;base64,anotherDataUri",
                    rules = CSSOM.parse('span { background-image: url("' + anImage + '"), url("' + aSecondImage + '"); }').cssRules,
                    match;

                mockGetDataURIForImageURL(anImage, anImagesDataUri);
                mockGetDataURIForImageURL(aSecondImage, aSecondImagesDataUri);

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function () {
                    expect(extractCssUrlSpy.mostRecentCall.args[0]).toMatch(new RegExp('url\\("?' + aSecondImage + '"?\\)'));

                    expect(rules[0].style.getPropertyValue('background-image')).toMatch(backgroundImageRegex);
                    match = backgroundImageRegex.exec(rules[0].style.getPropertyValue('background-image'));
                    expect(match[1]).toEqual(anImagesDataUri);
                    expect(match[2]).toEqual(aSecondImagesDataUri);

                    done();
                });
            });

            it("should not break background-position (#30)", function (done) {
                var rules = CSSOM.parse('span { background-image: url("anImage.png"); background-position: 0 center, right center;}').cssRules;

                mockGetDataURIForImageURL('anImage.png', "data:image/png;base64,someDataUri");

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function () {
                    expect(rules[0].style.getPropertyValue('background-position')).toMatch(/0(px)? (center|50%), (right|100%) (center|50%)/);

                    done();
                });
            });

            it("should handle a baseUrl", function () {
                var rules = CSSOM.parse('span { background-image: url("image.png"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {baseUrl:  'url_base/page.html'}, callback);

                expect(getDataURIForImageURLSpy.mostRecentCall.args[1].baseUrl).toEqual('url_base/page.html');
            });

            it("should circumvent caching if requested", function () {
                var anImage = "anImage.png",
                    rules = CSSOM.parse('span { background-image: url("' + anImage + '"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {cache:  'none'}, callback);

                expect(getDataURIForImageURLSpy).toHaveBeenCalledWith(anImage, {cache: 'none'});
            });

            it("should not circumvent caching by default", function () {
                var anImage = "anImage.png",
                    rules = CSSOM.parse('span { background-image: url("' + anImage + '"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, callback);

                expect(getDataURIForImageURLSpy).toHaveBeenCalledWith(anImage, {});
            });
        });

        describe("on background-image with errors", function () {
            var aBackgroundImageThatDoesExist = "a_backgroundImage_that_does_exist.png";

            beforeEach(function () {
                mockGetDataURIForImageURL(aBackgroundImageThatDoesExist, '');
                joinUrlSpy.andCallThrough();
            });

            it("should report an error if a backgroundImage could not be loaded", function (done) {
                var rules = CSSOM.parse('span { background-image: url("a_backgroundImage_that_doesnt_exist.png"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {baseUrl:  'some_base_url/'}, function (changed, errors) {
                    expect(changed).toBe(false);
                    expect(errors).toEqual([{
                        resourceType: "backgroundImage",
                        url: "some_base_url/a_backgroundImage_that_doesnt_exist.png",
                        msg: "Unable to load background-image some_base_url/a_backgroundImage_that_doesnt_exist.png"
                    }]);

                    done();
                });
            });

            it("should only report a failing backgroundImage as error", function (done) {
                var rules = CSSOM.parse('span { background-image: url("a_backgroundImage_that_doesnt_exist.png"); }\n' +
                    'span { background-image: url("' + aBackgroundImageThatDoesExist + '"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function (changed, errors) {
                    expect(errors).toEqual([{
                        resourceType: "backgroundImage",
                        url: "a_backgroundImage_that_doesnt_exist.png",
                        msg: jasmine.any(String)
                    }]);

                    done();
                });
            });

            it("should report multiple failing backgroundImages as error", function (done) {
                var rules = CSSOM.parse('span { background-image: url("a_backgroundImage_that_doesnt_exist.png"); }\n' +
                    'span { background-image: url("another_backgroundImage_that_doesnt_exist.png"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function (changed, errors) {
                    expect(errors).toEqual([jasmine.any(Object), jasmine.any(Object)]);
                    expect(errors[0]).not.toEqual(errors[1]);

                    done();
                });
            });

            it("should only report one failing backgroundImage for multiple in a rule", function (done) {
                var rules = CSSOM.parse('span { background-image: url("' + aBackgroundImageThatDoesExist + '"), url("a_backgroundImage_that_doesnt_exist.png"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function (changed, errors) {
                    expect(errors).toEqual([{
                        resourceType: "backgroundImage",
                        url: "a_backgroundImage_that_doesnt_exist.png",
                        msg: jasmine.any(String)
                    }]);

                    done();
                });
            });

            it("should report multiple failing backgroundImages in one rule as error", function (done) {
                var rules = CSSOM.parse('span { background-image: url("a_backgroundImage_that_doesnt_exist.png"), url("another_backgroundImage_that_doesnt_exist.png"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function (changed, errors) {
                    expect(errors).toEqual([jasmine.any(Object), jasmine.any(Object)]);
                    expect(errors[0]).not.toEqual(errors[1]);

                    done();
                });
            });

            it("should report an empty list for a successful backgroundImage", function (done) {
                var rules = CSSOM.parse('span { background-image: url("' + aBackgroundImageThatDoesExist + '"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function (changed, errors) {
                    expect(errors).toEqual([]);

                    done();
                });
            });
        });

        describe("on font-face", function () {
            var fontFaceSrcRegex = /url\("?([^\)"]+)"?\)(\s*format\("?([^\)"]+)"?\))?/,
                ajaxUrlMocks = {};

            var setupAjaxMock = function () {
                binaryAjaxSpy.andCallFake(function (url) {
                    var defer = ayepromise.defer();
                    if (ajaxUrlMocks[url] !== undefined) {
                        defer.resolve(ajaxUrlMocks[url]);
                    } else {
                        defer.reject();
                    }
                    return defer.promise;
                });
            };

            var mockBinaryAjaxUrl = function (url, content) {
                ajaxUrlMocks[url] = content;
            };

            var expectFontFaceUrlToMatch = function (rule, url, format) {
                var extractedUrl, match;

                match = fontFaceSrcRegex.exec(rule.style.getPropertyValue('src'));
                extractedUrl = match[1];
                expect(extractedUrl).toEqual(url);
                if (format) {
                    expect(match[3]).toEqual(format);
                }
            };

            beforeEach(function () {
                setupAjaxMock();
            });

            it("should not touch an already inlined font", function () {
                var rules = CSSOM.parse('@font-face { font-family: "test font"; src: url("data:font/woff;base64,soMEfAkebASE64="); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, callback);

                expectFontFaceUrlToMatch(rules[0], "data:font/woff;base64,soMEfAkebASE64=");
            });

            it("should ignore invalid values", function () {
                var rules = CSSOM.parse('@font-face { font-family: "test font"; src: "invalid url"; }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, callback);

                expect(binaryAjaxSpy).not.toHaveBeenCalled();
                expect(callback).toHaveBeenCalledWith(false, []);
            });

            it("should ignore a local font", function () {
                var rules = CSSOM.parse('@font-face { font-family: "test font"; src: local("font name"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, callback);

                expect(binaryAjaxSpy).not.toHaveBeenCalled();
                expect(callback).toHaveBeenCalledWith(false, []);
            });

            it("should inline a font", function (done) {
                var rules = CSSOM.parse('@font-face { font-family: "test font"; src: url("fake.woff"); }').cssRules;

                mockBinaryAjaxUrl('fake.woff', "this is not a font");

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function (changed) {
                    expect(changed).toBe(true);

                    expect(extractCssUrlSpy.mostRecentCall.args[0]).toMatch(new RegExp('url\\("?fake.woff"?\\)'));

                    expectFontFaceUrlToMatch(rules[0], "data:font/woff;base64,dGhpcyBpcyBub3QgYSBmb250");

                    done();
                });
            });

            it("should take a font from url with alternatives", function () {
                var rules = CSSOM.parse('@font-face { font-family: "test font"; src: local("font name"), url("fake.woff"); }').cssRules;
                mockBinaryAjaxUrl('fake.woff', '');

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, callback);

                expect(extractCssUrlSpy.mostRecentCall.args[0]).toMatch(new RegExp('url\\("?fake.woff"?\\)'));
            });

            it("should detect a woff", function (done) {
                var rules = CSSOM.parse('@font-face { font-family: "test font"; src: url("fake.woff") format("woff"); }').cssRules;

                mockBinaryAjaxUrl('fake.woff', "font's content");

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function () {
                    expectFontFaceUrlToMatch(rules[0], "data:font/woff;base64,Zm9udCdzIGNvbnRlbnQ=", 'woff');

                    done();
                });
            });

            it("should detect a truetype font", function (done) {
                var rules = CSSOM.parse('@font-face { font-family: "test font"; src: url("fake.ttf") format("truetype"); }').cssRules;

                mockBinaryAjaxUrl('fake.ttf', "font's content");

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function () {
                    expectFontFaceUrlToMatch(rules[0], "data:font/truetype;base64,Zm9udCdzIGNvbnRlbnQ=", 'truetype');

                    done();
                });
            });

            it("should detect a opentype font", function (done) {
                var rules = CSSOM.parse('@font-face { font-family: "test font"; src: url("fake.otf") format("opentype"); }').cssRules;

                mockBinaryAjaxUrl('fake.otf', "font's content");

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function () {
                    expectFontFaceUrlToMatch(rules[0], "data:font/opentype;base64,Zm9udCdzIGNvbnRlbnQ=", 'opentype');

                    done();
                });
            });

            ifNotInPhantomJsIt("should keep all src references intact", function (done) {
                var rules = CSSOM.parse('@font-face { font-family: "test font"; src: local("Fake Font"), url("fake.otf") format("opentype"), url("fake.woff"), local("Another Fake Font"); }').cssRules;

                mockBinaryAjaxUrl('fake.woff', "font");
                mockBinaryAjaxUrl('fake.otf', "font");

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function () {
                    expect(rules[0].style.getPropertyValue('src')).toMatch(/local\("?Fake Font"?\), url\("?data:font\/opentype;base64,Zm9udA=="?\) format\("?opentype"?\), url\("?data:font\/woff;base64,Zm9udA=="?\), local\("?Another Fake Font"?\)/);

                    done();
                });
            });

            it("should handle a baseUrl", function () {
                var rules = CSSOM.parse('@font-face { font-family: "test font"; src: url("fake.woff"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {baseUrl:  'url_base/page.html'}, callback);

                expect(binaryAjaxSpy.mostRecentCall.args[1].baseUrl).toEqual('url_base/page.html');
            });

            it("should circumvent caching if requested", function () {
                var fontUrl = "fake.woff",
                    rules = CSSOM.parse('@font-face { font-family: "test font"; src: url("' + fontUrl + '"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {cache: 'none'}, callback);

                expect(binaryAjaxSpy).toHaveBeenCalledWith(fontUrl, {cache: 'none'});
            });

            it("should not circumvent caching by default", function () {
                var fontUrl = "fake.woff",
                    rules = CSSOM.parse('@font-face { font-family: "test font"; src: url("' + fontUrl + '"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, callback);

                expect(binaryAjaxSpy).toHaveBeenCalledWith(fontUrl, {});
            });
        });

        describe("on font-face with errors", function () {
            var aFontReferenceThatDoesExist = "a_font_that_does_exist.woff";

            beforeEach(function () {
                binaryAjaxSpy.andCallFake(function (url) {
                    var defer = ayepromise.defer();
                    if (url === aFontReferenceThatDoesExist) {
                        defer.resolve();
                    } else {
                        defer.reject();
                    }
                    return defer.promise;
                });
                joinUrlSpy.andCallThrough();
            });

            it("should report an error if a font could not be loaded", function (done) {
                var rules = CSSOM.parse('@font-face { font-family: "test font"; src: url("a_font_that_doesnt_exist.woff"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {baseUrl:  'some_base_url/'}, function (changed, errors) {
                    expect(changed).toBe(false);
                    expect(errors).toEqual([{
                        resourceType: "fontFace",
                        url: "some_base_url/a_font_that_doesnt_exist.woff",
                        msg: "Unable to load font-face some_base_url/a_font_that_doesnt_exist.woff"
                    }]);

                    done();
                });
            });

            it("should only report a failing font as error", function (done) {
                var rules = CSSOM.parse('@font-face { font-family: "test font1"; src: url("a_font_that_doesnt_exist.woff"); }\n' +
                    '@font-face { font-family: "test font2"; src: url("' + aFontReferenceThatDoesExist + '"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function (changed, errors) {
                    expect(errors).toEqual([{
                        resourceType: "fontFace",
                        url: "a_font_that_doesnt_exist.woff",
                        msg: jasmine.any(String)
                    }]);

                    done();
                });
            });

            it("should report multiple failing fonts as error", function (done) {
                var rules = CSSOM.parse('@font-face { font-family: "test font1"; src: url("a_font_that_doesnt_exist.woff"); }\n' +
                    '@font-face { font-family: "test font2"; src: url("another_font_that_doesnt_exist.woff"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function (changed, errors) {
                    expect(errors).toEqual([jasmine.any(Object), jasmine.any(Object)]);
                    expect(errors[0]).not.toEqual(errors[1]);

                    done();
                });
            });

            it("should report an empty list for a successful backgroundImage", function (done) {
                var rules = CSSOM.parse('@font-face { font-family: "test font2"; src: url("' + aFontReferenceThatDoesExist + '"); }').cssRules;

                rasterizeHTMLInline.css.loadAndInlineCSSResourcesForRules(rules, {}, function (changed, errors) {
                    expect(errors).toEqual([]);

                    done();
                });
            });
        });
    });

});
