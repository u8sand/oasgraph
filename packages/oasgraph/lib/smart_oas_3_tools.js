"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Oas3Tools = require("./oas_3_tools");
/**
 * Label a list of OAS schemas by `info.title`
 *  for cross-schema referencing with `operationRef`.
 *
 * @param oass A list of OAS schemas
 * @returns A labeled list of OAS schemas
 */
function getLabeledOass(oass) {
    let labeledOass = {};
    oass.forEach(oas => {
        let schema = oas.info.title;
        if (typeof schema === 'undefined') {
            console.warn('schema titles are required for linking');
            return;
        }
        labeledOass[schema] = oas;
    });
    return labeledOass;
}
exports.getLabeledOass = getLabeledOass;
/**
 * Obtain groups of common `x-parameterValueType` parameters
 *  and their associated operations in each labeled OAS schema.
 *
 * @param labeledOass A list of labeled OAS schemas
 * @returns A dictionary with `x-parameterValueType` keys and
 *  pointers for obtaining the request and parameter.
 */
function getParameterValueTypes(labeledOass) {
    let parameterValueTypes = {};
    Object.keys(labeledOass).forEach(schema => {
        let oas = labeledOass[schema];
        for (let path in oas.paths) {
            for (let method in oas.paths[path]) {
                //  Only consider Operation Objects
                if (!Oas3Tools.isOperation(method)) {
                    continue;
                }
                // Parameters
                let parameters = Oas3Tools.getParameters(path, method, oas);
                for (let parameter of parameters) {
                    let name = parameter.name;
                    let parameterValueType = parameter['x-parameterValueType'];
                    if (typeof parameterValueType === 'undefined') {
                        continue;
                    }
                    if (typeof name === 'undefined') {
                        console.warn(`parameter in ${schema}#/paths/${path}/${method} does not have name`);
                        continue;
                    }
                    if (typeof parameterValueTypes[parameterValueType] === 'undefined') {
                        parameterValueTypes[parameterValueType] = [];
                    }
                    parameterValueTypes[parameterValueType].push({
                        schema,
                        path,
                        method,
                        name,
                    });
                }
            }
        }
    });
    return parameterValueTypes;
}
exports.getParameterValueTypes = getParameterValueTypes;
/**
 * For a given OAS schema, obtain the smart-links
 *  (basically the same as `Oas3.getEndpointLinks(...)`
 *   but for `x-links` instead of `links`)
 */
function getEndpointSmartLinks(path, method, oas, data) {
    let links = {};
    let endpoint = oas.paths[path][method];
    let statusCode = Oas3Tools.getResponseStatusCode(path, method, oas, data);
    if (!statusCode) {
        return links;
    }
    if (typeof endpoint.responses === 'object') {
        let responses = endpoint.responses;
        if (typeof responses[statusCode] === 'object') {
            let response = responses[statusCode];
            if (typeof response.$ref === 'string') {
                response = Oas3Tools.resolveRef(response.$ref, oas);
            }
            // here, we can be certain we have a ResponseObject:
            response = response;
            if (typeof response['x-links'] === 'object') {
                let epLinks = response['x-links'];
                for (let linkKey in epLinks) {
                    let link = epLinks[linkKey];
                    // make sure we have LinkObjects:
                    if (typeof link.$ref === 'string') {
                        link = Oas3Tools.resolveRef(link['$ref'], oas);
                    }
                    else {
                        link = link;
                    }
                    links[linkKey] = link;
                }
            }
        }
    }
    return links;
}
exports.getEndpointSmartLinks = getEndpointSmartLinks;
/**
 * Given smart links, generate regular links out of them
 *  by matching a semantics with existing ParameterValueTypes.
 *
 * @param smartLinks The Smart Links from `getEndpointSmartLinks`
 * @param parameterValueTypes The output of `getParameterValueTypes`
 * @param oas The current OAS being processed
 * @param labeledOass The output of `getLabeledOass`
 */
function generateLinksFromSmartLinks(smartLinks, parameterValueTypes, oas, labeledOass) {
    let schema = oas.info.title;
    let links = {};
    let linkOps = {};
    // Step 1: Establish link objects for all parameterValueType matches
    for (let smartLinkKey in smartLinks) {
        let smartLink = smartLinks[smartLinkKey];
        for (let smartLinkParameterKey in smartLink.parameters) {
            // Get parameterValueTypes which match the smartLink parameters
            //  and therefore can be potentially linked.
            let smartLinkParameterMatches = parameterValueTypes[smartLinkParameterKey];
            let smartLinkParameterValue = smartLink.parameters[smartLinkParameterKey];
            if (typeof smartLinkParameterMatches === 'undefined') {
                continue;
            }
            // Create a link for each match
            smartLinkParameterMatches.forEach(smartLinkParameterMatch => {
                let linkKey = smartLinkKey;
                let endpoint = labeledOass[smartLinkParameterMatch.schema].paths[smartLinkParameterMatch.path][smartLinkParameterMatch.method];
                let link = links[linkKey];
                // Ensure link valueType compatibility
                if (typeof smartLink["x-valueType"] !== 'undefined') {
                    let good = false;
                    for (let response_key in endpoint.responses) {
                        let response = endpoint.responses[response_key];
                        if (typeof response.$ref === 'string') {
                            response = Oas3Tools.resolveRef(response.$ref, oas);
                        }
                        else {
                            response = response;
                        }
                        if (typeof response["x-responseValueType"] !== 'undefined') {
                            if (response["x-responseValueType"] === smartLink["x-valueType"]) {
                                good = true;
                            }
                        }
                    }
                    if (good !== true) {
                        return;
                    }
                }
                // Construct link object if it doesn't yet exist
                if (typeof link === 'undefined') {
                    let operationRef = `${smartLinkParameterMatch.schema !== schema ? smartLinkParameterMatch.schema : ''}#/paths/${smartLinkParameterMatch.path.replace(/\//g, '~1')}/${smartLinkParameterMatch.method}`;
                    links[linkKey] = Object.assign({}, smartLink, { operationRef, parameters: {} });
                    // Save the path for the given linkKey
                    linkOps[linkKey] = endpoint;
                }
                // Parameter to link object
                links[linkKey].parameters[smartLinkParameterMatch.name] = smartLinkParameterValue;
            });
        }
    }
    // Step 2: Remove any link objects which would result in an incomplete API call
    for (let linkKey in links) {
        let link = links[linkKey];
        let endpoint = linkOps[linkKey];
        let defined_params = new Set(Object.keys(link.parameters));
        let good = true;
        endpoint.parameters.forEach((parameter) => {
            if (typeof parameter.$ref === 'string') {
                parameter = Oas3Tools.resolveRef(parameter.$ref, oas);
            }
            else {
                parameter = parameter;
            }
            if (parameter.required && !defined_params.has(parameter.name)) {
                good = false;
                console.warn(`Link: ${linkKey}: ${JSON.stringify(link)} could not be established due to missing parameter ${parameter.name}`);
                return;
            }
        });
        if (good !== true) {
            delete links[linkKey];
        }
    }
    return links;
}
exports.generateLinksFromSmartLinks = generateLinksFromSmartLinks;
//# sourceMappingURL=smart_oas_3_tools.js.map