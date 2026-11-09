import SwaggerParser from "@apidevtools/swagger-parser";
await SwaggerParser.validate("docs/api.yaml");
console.log("OpenAPI válido");
