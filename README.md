# Sales Tracker Pro

preciso criar um sistema para registro das vendas do meu time comercial. Não é um CRM, é só um controle das vendas efetuadas.

O sistema funcionaria com login e senha para cada vendedor, e no sistema, ele registraria uma "nova venda" inserindo os dados abaixo:

- nome do produto (selecionável)
- valor da venda
- plataforma de pagamento (selecionável)
- e-mail do comprador
- telefone do comprador
- tipo de venda (selecionável)
- Campo de observação

O adm precisa ter uma aba onde ele consegue inlcuir os produtos e especificar a comissão (em %) daquele produto específico.

plataformas que usamos: Kiwify, Hotmart, Lia, Própria
Tipo de venda: Passiva e Ativa

O vendedor tem a meta de conseguir, por mês, uma comissão de R$800. Preciso que tenha um dashboard com esses dados para ele acompanhar. Outras metas: vendas todo dia útil do mês. Se bater, libera mais um bônus. 

Na aba dashboard, quero que coloque todo dia, no topo, uma frase motivacional para que o vendedor se motive, além do compilado geral do mês: número total de vendas, comissão acumulada, tipos de vendas em um gráfico pizza, produto mais vendido, etc.

O adm pode cadastrar usuários e ver o desempenho de todos os vendedores (geral) e de cada (individual).

O adm validará todo mês as informações de venda para validar as informações e pagar os prêmios. Por isso, tem que ter uma forma de, somente o ADM, validar a venda. O feedback disso aparecerá na visão geral do vendendor como "validado" a frente da venda, ou "não validado" quando não proceder. 

o vendedor tem que ter uma visão de lista geral também de todas suas vendas, para que ele possa checar rápido informações, e editá-las se precisar, antes da validação do adm. dps que o adm validar, ele não consegue mais editar aquela venda. 

Quero o sistema com layout clean, black. 

me faça perguntas se precisar, antes de criá-lo.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://controledevendas1st.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a10cc74d-a6df-47fa-ad13-86ecc2198302).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
