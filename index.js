// const express = require('express');
// const axios = require('axios');
// require('dotenv').config();


// const app = express();
// app.use(express.json());

// // HubSpot API key (заміни на свій)
// const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
// const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// app.get('/', (req, res) => {
//   res.send('OK');
// });

// // Головний endpoint: одна кастомна дія
// app.post('/process-inquiry', async (req, res) => {
//   const { full_name, phone, email, reason, message } = req.body;
  

//   try {
//     // КРОК 1: Шукаємо контакт за email
//     const searchResponse = await axios.post(
//       `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
//       {
//         filterGroups: [
//           {
//             filters: [
//               {
//                 propertyName: 'email',
//                 operator: 'EQ',
//                 value: email
//               }
//             ]
//           }
//         ],
//         properties: ['email', 'firstname', 'lastname']
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${HUBSPOT_API_KEY}`,
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     let contactId;

//     if (searchResponse.data.total > 0) {
//       // Контакт існує
//       contactId = searchResponse.data.results[0].id;
//     } else {
//       // Контакт не існує → створюємо нового
//       const createContactResponse = await axios.post(
//         `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts`,
//         {
//           properties: {
//             firstname: full_name,
//             phone: phone,
//             email: email
//           }
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${HUBSPOT_API_KEY}`,
//             'Content-Type': 'application/json'
//           }
//         }
//       );

//       contactId = createContactResponse.data.id;
//     }

//     // КРОК 2: Створюємо нотатку або угоду
//     if (reason.toLowerCase().includes('partnership') ||
//         reason.toLowerCase().includes('vendor') ||
//         reason.toLowerCase().includes('bpo') ||
//         reason.toLowerCase().includes('product') ||
//         reason.toLowerCase().includes('service')) {
//       // Дзвінок по продажах — створюємо Deal
//       await axios.post(
//         `${HUBSPOT_BASE_URL}/crm/v3/objects/deals`,
//         {
//           properties: {
//             dealname: `New ${reason} Inquiry`,
//             description: message,
//             dealstage: 'appointmentscheduled', // або твій потрібний stage
//             pipeline: 'default'
//           },
//           associations: [
//             {
//               to: { id: contactId },
//               types: [
//                 {
//                   associationCategory: 'HUBSPOT_DEFINED',
//                   associationTypeId: 3 // Contact to Deal
//                 }
//               ]
//             }
//           ]
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${HUBSPOT_API_KEY}`,
//             'Content-Type': 'application/json'
//           }
//         }
//       );
//     } else {
//       // Дзвінок не по продажах — створюємо нотатку
//       await axios.post(
//         `${HUBSPOT_BASE_URL}/engagements/v1/engagements`,
//         {
//           engagement: {
//             active: true,
//             type: 'NOTE'
//           },
//           associations: {
//             contactIds: [contactId]
//           },
//           metadata: {
//             body: message
//           }
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${HUBSPOT_API_KEY}`,
//             'Content-Type': 'application/json'
//           }
//         }
//       );
//     }

//     return res.status(200).json({ message: 'Processed successfully', contactId });

//   } catch (error) {
//     console.error(error.response?.data || error.message);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

// app.listen(3000, () => {
//   console.log('Backend listening on port 3000');
// });



const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

app.get('/', (req, res) => {
  res.send('OK');
});

app.post('/process-inquiry', async (req, res) => {
  const { full_name, phone, email, reason, message, company_name } = req.body;

  if (!email || !reason) {
    return res.status(400).json({ error: 'Missing required fields: email and reason are mandatory.' });
  }

  try {
    let companyId = null;

    // === КРОК 1: Якщо передано company_name → створити компанію ===
    if (company_name) {
      const createCompanyResponse = await axios.post(
        `${HUBSPOT_BASE_URL}/crm/v3/objects/companies`,
        {
          properties: {
            name: company_name
          }
        },
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      companyId = createCompanyResponse.data.id;
    }

    // === КРОК 2: Шукаємо контакт ===
    const searchResponse = await axios.post(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: email
              }
            ]
          }
        ],
        properties: ['email', 'firstname', 'lastname']
      },
      {
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let contactId;

    if (searchResponse.data.total > 0) {
      contactId = searchResponse.data.results[0].id;
    } else {
      const createContactResponse = await axios.post(
        `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts`,
        {
          properties: {
            firstname: full_name,
            phone: phone,
            email: email
          }
        },
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      contactId = createContactResponse.data.id;
    }
    

    // === КРОК 3: Якщо є companyId — звʼязати контакт із компанією ===
    if (companyId) {
      // Створюємо асоціацію Contact → Company (звичайна)
      await axios.put(
        `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/${contactId}/associations/companies/${companyId}/contact_to_company`,
        {},
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // === КРОК 3.1: Робимо цю асоціацію Primary ===
      await axios.post(
        `${HUBSPOT_BASE_URL}/crm/v4/associations/contacts/companies/batch/create`,
        {
          inputs: [
            {
              from: { id: contactId },
              to: { id: companyId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: 1, // Contact to Company
                  label: 'PRIMARY'
                }
              ]
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
    }


    


    // === КРОК 4: Deal або Note ===
    if (
      reason.toLowerCase().includes('partnership') ||
      reason.toLowerCase().includes('vendor') ||
      reason.toLowerCase().includes('bpo') ||
      reason.toLowerCase().includes('product') ||
      reason.toLowerCase().includes('service')
    ) {
      await axios.post(
        `${HUBSPOT_BASE_URL}/crm/v3/objects/deals`,
        {
          properties: {
            dealname: `New ${reason} Inquiry`,
            description: message,
            dealstage: 'appointmentscheduled',
            pipeline: 'default'
          },
          associations: [
            {
              to: { id: contactId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: 3
                }
              ]
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } else {
      await axios.post(
        `${HUBSPOT_BASE_URL}/engagements/v1/engagements`,
        {
          engagement: {
            active: true,
            type: 'NOTE'
          },
          associations: {
            contactIds: [contactId]
          },
          metadata: {
            body: message
          }
        },
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    return res.status(200).json({ message: 'Processed successfully', contactId, companyId });

  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(3000, () => {
  console.log('Backend listening on port 3000');
});
