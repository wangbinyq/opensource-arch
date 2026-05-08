```mermaid
flowchart TD
    A[GetAdaptor(apiType)] --> B{Switch APIType}
    B -->|APITypeAnthropic| C[claude.Adaptor]
    B -->|APITypeOpenAI| D[openai.Adaptor]
    B -->|APITypeGemini| E[gemini.Adaptor]
    B -->|APITypeBaidu| F[baidu.Adaptor]
    B -->|APIType...| G[35+ 其他 Adaptor]
```
