// // backend/index.js
// const express = require('express');
// const axios = require('axios');
// const bodyParser = require('body-parser');
// require('dotenv').config();

// const app = express();
// const PORT = process.env.PORT || 3000;
// const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

// app.use(bodyParser.json());

// const hubspotHeaders = {
//   Authorization: `Bearer ${HUBSPOT_API_KEY}`,
//   'Content-Type': 'application/json'
// };

// // 1. Check if contact exists by email
// app.post('/check_contact_by_email', async (req, res) => {
//   const { email } = req.body;
//   try {
//     const response = await axios.post(
//       'https://api.hubapi.com/crm/v3/objects/contacts/search',
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
//         properties: ['email', 'message']
//       },
//       { headers: hubspotHeaders }
//     );

//     if (response.data.results.length > 0) {
//       return res.json({
//         exists: true,
//         contactId: response.data.results[0].id,
//         currentMessage: response.data.results[0].properties.message || ''
//       });
//     } else {
//       return res.json({ exists: false });
//     }
//   } catch (error) {
//     console.error('Error checking contact:', error.response?.data || error.message);
//     res.status(500).send('Error checking contact');
//   }
// });

// // 2. Create new contact
// app.post('/create_contact', async (req, res) => {
//   const { name, email, phone, reason } = req.body;
//   const [firstname, ...rest] = name.split(' ');
//   const lastname = rest.join(' ') || '—';

//   try {
//     const response = await axios.post(
//       'https://api.hubapi.com/crm/v3/objects/contacts',
//       {
//         properties: {
//           firstname,
//           lastname,
//           email,
//           phone,
//           message: reason,
//           hs_lead_status: 'NEW'
//         }
//       },
//       { headers: hubspotHeaders }
//     );

//     return res.json({ contactId: response.data.id });
//   } catch (error) {
//     console.error('Error creating contact:', error.response?.data || error.message);
//     res.status(500).send('Error creating contact');
//   }
// });

// // 3. Create a note (engagement) for contact AND update existing contact message
// app.post('/create_note_for_contact', async (req, res) => {
//   const { contactId, note, email, reason, currentMessage } = req.body;

//   try {
//     // 3.1 Create a new engagement note
//     await axios.post(
//       'https://api.hubapi.com/engagements/v1/engagements',
//       {
//         engagement: {
//           active: true,
//           type: 'NOTE'
//         },
//         associations: {
//           contactIds: [parseInt(contactId)]
//         },
//         metadata: {
//           body: note
//         }
//       },
//       { headers: hubspotHeaders }
//     );

//     // 3.2 Update the contact's "message" field
//     const updatedMessage = `${currentMessage}\n\n[REPEAT APPLICATION]\n${reason}`;
//     await axios.patch(
//       `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
//       {
//         properties: {
//           message: updatedMessage
//         }
//       },
//       { headers: hubspotHeaders }
//     );

//     res.json({ success: true });
//   } catch (error) {
//     console.error('Error creating note or updating message:', error.response?.data || error.message);
//     res.status(500).send('Error creating note or updating message');
//   }
// });

// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });




const express = require('express');
const axios = require('axios');
require('dotenv').config();


const app = express();
app.use(express.json());

// HubSpot API key (заміни на свій)
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Головний endpoint: одна кастомна дія
app.post('/process-inquiry', async (req, res) => {
  const { full_name, phone, email, reason, message } = req.body;
  console.log(full_name);
  console.log(phone);
  console.log(email);
  console.log(reason);
  console.log(message);

  try {
    // КРОК 1: Шукаємо контакт за email
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
      // Контакт існує
      contactId = searchResponse.data.results[0].id;
    } else {
      // Контакт не існує → створюємо нового
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

    // КРОК 2: Створюємо нотатку або угоду
    if (reason.toLowerCase().includes('partnership') ||
        reason.toLowerCase().includes('vendor') ||
        reason.toLowerCase().includes('bpo') ||
        reason.toLowerCase().includes('product') ||
        reason.toLowerCase().includes('service')) {
      // Дзвінок по продажах — створюємо Deal
      await axios.post(
        `${HUBSPOT_BASE_URL}/crm/v3/objects/deals`,
        {
          properties: {
            dealname: `New ${reason} Inquiry`,
            description: message,
            dealstage: 'appointmentscheduled', // або твій потрібний stage
            pipeline: 'default'
          },
          associations: [
            {
              to: { id: contactId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: 3 // Contact to Deal
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
      // Дзвінок не по продажах — створюємо нотатку
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

    return res.status(200).json({ message: 'Processed successfully', contactId });

  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(3000, () => {
  console.log('Backend listening on port 3000');
});
