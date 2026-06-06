import ollama from "ollama";

export default defineEventHandler(async () => {

  const response =
    await ollama.chat({

      model: "llama3.2:latest",

      messages: [
        {
          role: "user",
          content: "hola"
        }
      ]

    });

  return response;

});