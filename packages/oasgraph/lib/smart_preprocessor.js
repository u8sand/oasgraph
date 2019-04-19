"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function smart_preprocessor(schemas) {
    // Assemble semantic parameters
    const semantics = {};
    for (const schema of schemas) {
        if (schema.info.title === undefined) {
            console.warn('schema titles are required for linking');
            continue;
        }
        const schemaId = schema.info.title;
        for (const path of Object.keys(schema.paths)) {
            if (schema.paths[path] === undefined)
                continue;
            for (const method of Object.keys(schema.paths[path])) {
                if (schema.paths[path][method].parameters === undefined)
                    continue;
                for (const parameter of schema.paths[path][method].parameters) {
                    if (parameter['x-parameterType'] === undefined)
                        continue;
                    if (semantics[parameter['x-parameterType']] === undefined)
                        semantics[parameter['x-parameterType']] = [];
                    semantics[parameter['x-parameterType']].push({
                        operationRef: `${schemaId}#/paths/${path.replace('/', '~1')}/${method}`,
                        schemaId: schemaId,
                        path: path,
                        method: method,
                        parameter: parameter['name']
                    });
                }
            }
        }
    }
    // Generate semantic links
    const links = {};
    for (const schema of schemas) {
        if (schema.info.title === undefined)
            continue;
        const schemaId = schema.info.title;
        if (schema.paths === undefined)
            continue;
        for (const path of Object.keys(schema.paths)) {
            if (schema.paths[path] === undefined)
                continue;
            for (const method of Object.keys(schema.paths[path])) {
                if (schema.paths[path][method].responses === undefined)
                    continue;
                for (const response_code of Object.keys(schema.paths[path][method].responses)) {
                    const response = schema.paths[path][method].responses[response_code];
                    if (response['x-responseValueType'] === undefined)
                        continue;
                    for (const responseValueType of response['x-responseValueType']) {
                        if (semantics[responseValueType['x-valueType']] === undefined)
                            continue;
                        if (links[schemaId] === undefined)
                            links[schemaId] = {};
                        for (const semantic of semantics[responseValueType['x-valueType']]) {
                            if (links[schemaId][responseValueType['x-valueType']] === undefined)
                                links[schemaId][responseValueType['x-valueType']] = {};
                            if (links[schemaId][responseValueType['x-valueType']][semantic.operationRef] === undefined)
                                links[schemaId][responseValueType['x-valueType']][semantic.operationRef] = {
                                    to: semantic,
                                    from: {
                                        operationRef: `${schemaId}#/paths/${path.replace('/', '~1')}/${method}`,
                                        schemaId: schemaId,
                                        path: path,
                                        method: method,
                                        response: response,
                                    },
                                    parameters: {},
                                };
                            links[schemaId][responseValueType['x-valueType']][semantic.operationRef].parameters[semantic.parameter] = `$response.body#/${responseValueType['x-path']}`;
                        }
                    }
                }
            }
        }
    }
    // Actually add links to schemas
    let n = 0;
    for (const schemaId of Object.keys(links)) {
        for (const semantic of Object.keys(links[schemaId])) {
            for (const op of Object.keys(links[schemaId][semantic])) {
                const operation = links[schemaId][semantic][op];
                // ensure all responses are satisfied
                let good = true;
                for (const param of schemas[operation.to.schemaId]['paths'][operation.to.path][operation.to.method]) {
                    if (param.required !== true)
                        continue;
                    if (operation.parameters[param.name] === undefined) {
                        console.log(`link not created because ${operation.from.operationRef} => ${operation.to.operationRef}.${param.name} missing`);
                        good = false;
                    }
                }
                if (!good)
                    continue;
                // actually create links
                console.log(`linking ${operation.from.operationRef} => ${operation.to.operationRef}`);
                if (operation.from.response.links === undefined)
                    operation.from.response.links = {};
                operation.from.response.links[`AutoLink${n}`] = {
                    operationRef: operation.to.operationRef,
                    parameters: operation.parameters,
                };
                n += 1;
            }
        }
    }
    return schemas;
}
exports.default = smart_preprocessor;
//# sourceMappingURL=smart_preprocessor.js.map